#!/usr/bin/env python3
"""Deploy Jackwork live: D1 database + schema, the Worker (backend and
static client build), workers.dev enable, and the jackwork.bjvfi.com
custom domain. Follows the bjvfi-mail worker deploy pattern.

Usage: python3 deploy.py [--skip-domain]
State (database id, subdomain) is kept in state.json beside this file.
"""
import glob, json, os, secrets, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cfapi import req, req_json, ACCOUNT, ZONE_BJVFI

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, "repo")
NAME = "jackwork"
DB_NAME = "jackwork"
HOSTNAME = "jackwork.bjvfi.com"
STATE_PATH = os.path.join(HERE, "state.json")


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH) as f:
            return json.load(f)
    return {}


def save_state(state):
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


def err_msg(d):
    errs = d.get("errors") or [{}]
    return errs[0].get("message", "") if errs else ""


def main():
    skip_domain = "--skip-domain" in sys.argv
    state = load_state()

    # 1. workers.dev subdomain (needed for the fallback URL)
    st, d = req("GET", f"/accounts/{ACCOUNT}/workers/subdomain")
    sub = (d.get("result") or {}).get("subdomain") or state.get("workers_subdomain")
    print("workers subdomain:", st, sub or err_msg(d))
    if not sub:
        print("BLOCKED: account has no workers.dev subdomain and none was returned.")
        return 1
    state["workers_subdomain"] = sub
    save_state(state)

    # 2. D1 database
    db_id = state.get("d1_database_id")
    if not db_id:
        st, d = req("GET", f"/accounts/{ACCOUNT}/d1/database?name={DB_NAME}")
        results = (d.get("result") or [])
        if results:
            db_id = results[0]["uuid"]
            print("D1 database exists:", db_id)
        else:
            st, d = req_json("POST", f"/accounts/{ACCOUNT}/d1/database", {"name": DB_NAME})
            print("D1 create:", st, "success:", d.get("success"), err_msg(d))
            if not d.get("success"):
                return 1
            db_id = d["result"]["uuid"]
        state["d1_database_id"] = db_id
        save_state(state)
    print("D1 database id:", db_id)

    # 3. schema (idempotent, IF NOT EXISTS everywhere)
    with open(os.path.join(REPO, "worker", "schema.sql")) as f:
        sql_text = f.read()
    statements = []
    for chunk in sql_text.split(";"):
        lines = [ln for ln in chunk.splitlines() if not ln.strip().startswith("--")]
        stmt = "\n".join(lines).strip()
        if stmt:
            statements.append(stmt)
    # Column names already on jobs, so ALTER TABLE ADD COLUMN
    # statements for lifecycle fields can be skipped when present.
    job_columns = set()
    st, d = req_json("POST", f"/accounts/{ACCOUNT}/d1/database/{db_id}/query", {"sql": "PRAGMA table_info(jobs)"})
    if d.get("success"):
        for row in ((d.get("result") or [{}])[0].get("results") or []):
            if row.get("name"):
                job_columns.add(row["name"])
    applied = 0
    for stmt in statements:
        upper = stmt.upper()
        if upper.startswith("ALTER TABLE JOBS ADD COLUMN"):
            parts = stmt.split()
            if len(parts) >= 6 and parts[5] in job_columns:
                continue
        st, d = req_json("POST", f"/accounts/{ACCOUNT}/d1/database/{db_id}/query", {"sql": stmt})
        if not d.get("success"):
            if "duplicate column name" in err_msg(d).lower():
                continue
            print("SCHEMA FAILED on:", stmt[:80], st, err_msg(d))
            return 1
        applied += 1
    print(f"schema applied: {applied} statements")

    # 4. upload the worker script with the static build as data parts
    web = os.path.join(REPO, "web")
    with open(os.path.join(web, "index.html"), "rb") as f:
        index_html = f.read()
    js_files = glob.glob(os.path.join(web, "assets", "*.js"))
    css_files = glob.glob(os.path.join(web, "assets", "*.css"))
    icon192 = glob.glob(os.path.join(web, "assets", "*icon-192*.png"))
    icon512 = glob.glob(os.path.join(web, "assets", "*icon-512*.png"))
    assert len(js_files) == 1 and len(css_files) == 1 and len(icon192) == 1 and len(icon512) == 1, (js_files, css_files, icon192, icon512)
    parts = [
        ("asset_index.bin", index_html, "application/octet-stream"),
        ("asset_main.bin", open(js_files[0], "rb").read(), "application/octet-stream"),
        ("asset_style.bin", open(css_files[0], "rb").read(), "application/octet-stream"),
        ("asset_icon192.bin", open(icon192[0], "rb").read(), "application/octet-stream"),
        ("asset_icon512.bin", open(icon512[0], "rb").read(), "application/octet-stream"),
    ]
    with open(os.path.join(REPO, "worker", "worker.js"), "rb") as f:
        code = f.read()
    meta = {
        "main_module": "worker.js",
        "compatibility_date": "2025-01-01",
        "bindings": [{"type": "d1", "name": "DB", "id": db_id}],
    }
    boundary = "----muse" + secrets.token_hex(8)
    body = b""
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\nContent-Type: application/json\r\n\r\n".encode()
    body += json.dumps(meta).encode() + b"\r\n"
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"worker.js\"; filename=\"worker.js\"\r\nContent-Type: application/javascript+module\r\n\r\n".encode()
    body += code + b"\r\n"
    for part_name, data, ctype in parts:
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{part_name}\"; filename=\"{part_name}\"\r\nContent-Type: {ctype}\r\n\r\n".encode()
        body += data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    st, d = req("PUT", f"/accounts/{ACCOUNT}/workers/scripts/{NAME}", body, f"multipart/form-data; boundary={boundary}")
    print("script upload:", st, "success:", d.get("success"), err_msg(d) if not d.get("success") else "")
    if not d.get("success"):
        return 1

    # 5. enable workers.dev
    st, d = req_json("POST", f"/accounts/{ACCOUNT}/workers/scripts/{NAME}/subdomain", {"enabled": True})
    print("workers.dev enable:", st, "success:", d.get("success"), err_msg(d) if not d.get("success") else "")
    print("workers.dev URL: https://%s.%s.workers.dev" % (NAME, sub))

    # 6. custom domain jackwork.bjvfi.com (Cloudflare creates the DNS record)
    if not skip_domain:
        st, d = req_json("PUT", f"/accounts/{ACCOUNT}/workers/domains", {
            "hostname": HOSTNAME,
            "service": NAME,
            "environment": "production",
            "zone_id": ZONE_BJVFI,
        })
        print("custom domain:", st, "success:", d.get("success"), err_msg(d) if not d.get("success") else "")
        if d.get("success"):
            print("live URL: https://" + HOSTNAME)
    return 0


if __name__ == "__main__":
    sys.exit(main())

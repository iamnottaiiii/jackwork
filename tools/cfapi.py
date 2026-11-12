#!/usr/bin/env python3
"""Shared Cloudflare API access through the custom.cloudflare connector.
Modeled on ~/workspace/bjvfi-mail-worker/deploy.py. Never prints credentials."""
import json, sys, urllib.request, urllib.error
sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

EMAIL = "iamnottaiii@gmail.com"
ACCOUNT = "693d6b9511434212aa0a3cecff66ef39"
ZONE_BJVFI = "239dfc72de669c7e9087ce67c8268252"
BASE = "https://api.cloudflare.com/client/v4"

def req(method, path, data=None, ctype=None):
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("X-Auth-Email", EMAIL)
    if ctype:
        r.add_header("Content-Type", ctype)
    add_surrogate_to_request(r, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            return resp.status, read_json_response(resp)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}

def req_json(method, path, obj):
    return req(method, path, json.dumps(obj).encode(), "application/json")

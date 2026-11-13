// Jackwork live backend: ONE Cloudflare Worker that serves the static
// client build (web/, byte-identical to the Space production bundle) and
// answers the client's action calls (POST /actions with {action, args})
// from a D1 database. This is a faithful rehost of the Space actions in
// server/src/actions.ts: same actions, same shapes, same security rules.
//
// Asset parts are uploaded beside this module by tools/deploy.py:
//   asset_index.bin  (web/index.html)
//   asset_main.bin   (web/assets/index-*.js)
//   asset_style.bin  (web/assets/index-*.css)
//   asset_icon192.bin, asset_icon512.bin
import indexHtml from "./asset_index.bin";
import mainJs from "./asset_main.bin";
import styleCss from "./asset_style.bin";
import icon192 from "./asset_icon192.bin";
import icon512 from "./asset_icon512.bin";
import adminHtml from "./asset_admin.bin";

/* ---------------- helpers ---------------- */

function digitsOnly(s) {
  return String(s ?? "").replace(/\D/g, "");
}

// The Space's phone matching: equal, or either side ends with the other
// side's last 7 digits (local numbers get typed with and without the
// country code).
function samePhone(a, b) {
  const d = digitsOnly(a);
  const t = digitsOnly(b);
  if (!d || !t) return false;
  return d === t || d.endsWith(t.slice(-7)) || t.endsWith(d.slice(-7));
}

function bad(msg) {
  const e = new Error(msg);
  e.isInputError = true;
  return e;
}

function reqStr(v, name, min, max) {
  if (typeof v !== "string" || v.length < min || v.length > max) {
    throw bad(`Invalid ${name}.`);
  }
  return v;
}
function optStr(v, name, max, def) {
  if (v === undefined || v === null) return def;
  if (typeof v !== "string" || v.length > max) throw bad(`Invalid ${name}.`);
  return v;
}
function optInt(v, name, min, max) {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw bad(`Invalid ${name}.`);
  }
  return v;
}
function optNum(v, name, min, max) {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || v < min || v > max) throw bad(`Invalid ${name}.`);
  return v;
}
function reqId(v, name) {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw bad(`Invalid ${name}.`);
  }
  return v;
}
function optBool(v, def) {
  if (v === undefined || v === null) return def;
  return v === true;
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// In the Space, blob URLs came from the host blob store. Here the worker
// itself serves them under /blobs/<key>.
function blobUrl(key) {
  return "/blobs/" + key.split("/").map(encodeURIComponent).join("/");
}

/* Placeholder safety valve: if the poster does not confirm or report
   a problem within this window after the worker marks the job done,
   the job completes automatically and the simulated payout shows. */
const AUTO_CONFIRM_MS = 24 * 60 * 60 * 1000;

const ADMIN_PHONE = "+12297120887";

/* The current Terms version. There are two sets at this
   version, Worker Terms and User Terms; agreeing is recorded
   server side with this version, the set the person picked
   (terms_role), and the time. A profile that has never agreed
   gets the gate. A profile that agreed to version 1 (the first
   combined terms) stays agreed, so existing people are never
   trapped at the gate by the split into two sets. */
const CURRENT_TERMS_VERSION = 2;

/* Text message notifications: the sending path exists, behind
   provider config. All three stay UNSET until a real SMS line is
   connected later: SMS_PROVIDER (the provider's HTTPS send
   endpoint), SMS_API_KEY, SMS_SENDER_ID. While any of them is
   unset, no text is sent, nothing anywhere claims one was, and
   every notification records sms_status 'waiting_for_line'. */
const SMS_PROVIDER = "";
const SMS_API_KEY = "";
const SMS_SENDER_ID = "";

/* Calls used to go through the phone dialer with the number
   handed out only at tap time. That is gone: contact between the
   two people on a job is now inside the app (chat, and voice
   calls browser to browser over the internet), so no number is
   ever dialed, shown, or handed out at all. There is no call
   relay config anymore because in-app calls need no phone line. */

function smsConfigured() {
  return !!(SMS_PROVIDER && SMS_API_KEY && SMS_SENDER_ID);
}

async function sendNotificationSms(phone, text) {
  /* Only ever called when a provider line is connected. Posts the
     message as JSON to the provider endpoint with the API key as
     a bearer token. Returns "sent" or "failed". */
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const resp = await fetch(SMS_PROVIDER, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${SMS_API_KEY}` },
        body: JSON.stringify({ from: SMS_SENDER_ID, to: phone, text }),
        signal: ctrl.signal,
      });
      return resp.ok ? "sent" : "failed";
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "failed";
  }
}

async function allRows(env, sql, params = []) {
  const r = await env.DB.prepare(sql).bind(...params).all();
  return r.results || [];
}
async function firstRow(env, sql, params = []) {
  return await env.DB.prepare(sql).bind(...params).first();
}
async function runSql(env, sql, params = []) {
  return await env.DB.prepare(sql).bind(...params).run();
}

/* ---------------- row shaping (same shapes as the Space) ---------------- */

function publicPlace(row) {
  if (row.landmark && String(row.landmark).trim()) return String(row.landmark).trim();
  return String(row.location ?? "").split(",")[0]?.trim() || row.location;
}

function toJob(row, partyRole = false) {
  const stripPrivate = !partyRole;
  const publicBoard = stripPrivate && row.status === "open";
  const iso = (v) => (v == null ? null : new Date(v).toISOString());
  return {
    id: row.id,
    title: row.title,
    category: publicBoard ? "" : row.category,
    description: publicBoard ? "" : row.description,
    location: publicBoard ? publicPlace(row) : row.location,
    landmark: publicBoard ? null : (row.landmark ?? null),
    budgetAmount: row.budget_amount ?? null,
    budgetCurrency: row.budget_currency,
    budgetType: row.budget_type,
    urgency: row.urgency,
    scheduledDate: row.scheduled_date ?? null,
    scheduledTime: row.scheduled_time ?? null,
    // Phone numbers are never shared between the two people on a
    // job: each side's payload carries only its OWN numbers. The
    // worker's payload has no poster number at all, and the poster's
    // payload has no worker number. Contact between the two sides
    // is in-app chat and in-app voice calls, so no number is ever
    // printed, handed out, or dialed. The house directions and the poster's
    // own GPS pin still go only to the two parties, never to other
    // board viewers. placeLat/placeLng stay: they are the surveyed
    // coordinates of a named town from the public settlement dataset.
    houseDirections: stripPrivate ? null : (row.house_directions ?? null),
    customerName: publicBoard ? "" : row.customer_name,
    customerPhone: partyRole === "poster" ? row.customer_phone : "",
    contactPhone: partyRole === "poster" ? (row.contact_phone ?? null) : null,
    task: publicBoard ? null : (row.task ?? null),
    customerProfileId: publicBoard ? null : (row.customer_profile_id ?? null),
    gpsLat: stripPrivate ? null : (row.gps_lat ?? null),
    gpsLng: stripPrivate ? null : (row.gps_lng ?? null),
    placeLat: row.place_lat ?? null,
    placeLng: row.place_lng ?? null,
    status: row.status,
    providerName: publicBoard ? null : (row.provider_name ?? null),
    providerPhone: partyRole === "worker" ? (row.provider_phone ?? null) : null,
    providerId: publicBoard ? null : (row.provider_id ?? null),
    workerConfirmedAt: publicBoard ? null : iso(row.worker_confirmed_at),
    proposedBudgetAmount: publicBoard ? null : (row.proposed_budget_amount ?? null),
    priceProposedAt: publicBoard ? null : iso(row.price_proposed_at),
    paymentState: row.payment_state ?? "waiting",
    paymentMarkedAt: publicBoard ? null : iso(row.payment_marked_at),
    beforeProofUrl: stripPrivate || !row.before_proof_blob_key ? null : blobUrl(row.before_proof_blob_key),
    beforeProofMime: stripPrivate ? null : (row.before_proof_mime ?? null),
    afterProofUrl: stripPrivate || !row.after_proof_blob_key ? null : blobUrl(row.after_proof_blob_key),
    afterProofMime: stripPrivate ? null : (row.after_proof_mime ?? null),
    workerDoneAt: publicBoard ? null : iso(row.worker_done_at),
    posterConfirmedAt: publicBoard ? null : iso(row.poster_confirmed_at),
    completedAt: publicBoard ? null : iso(row.completed_at),
    autoCompleted: publicBoard ? false : row.auto_completed === 1,
    problemReported: publicBoard ? false : row.problem_reported === 1,
    problemBy: publicBoard ? null : (row.problem_by ?? null),
    problemAt: publicBoard ? null : iso(row.problem_at),
    rating: publicBoard ? null : (row.rating ?? null),
    review: publicBoard ? null : (row.review ?? null),
    payMethod: "Mobile Money",
    ratingByProvider: publicBoard ? null : (row.rating_by_provider ?? null),
    reviewByProvider: publicBoard ? null : (row.review_by_provider ?? null),
    createdAt: publicBoard ? new Date(0).toISOString() : new Date(row.created_at).toISOString(),
    updatedAt: publicBoard ? new Date(0).toISOString() : new Date(row.updated_at).toISOString(),
  };
}

async function actorForToken(env, sessionToken) {
  if (!sessionToken) return null;
  return await firstRow(env, "SELECT * FROM profiles WHERE session_token = ?", [sessionToken]);
}

async function jobForId(env, jobId) {
  return await firstRow(env, "SELECT * FROM jobs WHERE id = ?", [jobId]);
}

function isPosterRow(job, actor) {
  return job.customer_profile_id === actor.id || (job.customer_phone && samePhone(job.customer_phone, actor.phone));
}

function isWorkerRow(job, actor) {
  return job.provider_id === actor.id || (job.provider_phone && samePhone(job.provider_phone, actor.phone));
}

function isPoster(job, actor) {
  return !!actor && (job.customer_profile_id === actor.id || samePhone(job.customer_phone, actor.phone));
}

function isWorker(job, actor) {
  return !!actor && (job.provider_id === actor.id || (!!job.provider_phone && samePhone(job.provider_phone, actor.phone)));
}

async function autoCompleteDueJobs(env) {
  const dueBefore = Date.now() - AUTO_CONFIRM_MS;
  const now = Date.now();
  const due = await allRows(
    env,
    `SELECT * FROM jobs WHERE status = 'worker_done' AND problem_reported = 0
       AND worker_done_at IS NOT NULL AND worker_done_at <= ?`,
    [dueBefore],
  );
  if (due.length === 0) return;
  await runSql(
    env,
    `UPDATE jobs SET status = 'completed', payment_state = 'paid', completed_at = ?,
       auto_completed = 1, updated_at = ?
     WHERE status = 'worker_done' AND problem_reported = 0
       AND worker_done_at IS NOT NULL AND worker_done_at <= ?`,
    [now, now, dueBefore],
  );
  for (const job of due) {
    await notifyJobEvent(env, job.provider_id, job, "completed", completedNotificationText(job));
  }
}

/* ---------------- notifications ----------------
   One row per job event for the person it concerns, then the
   same one line goes out as a Web Push to their subscriptions,
   and as a text message when an SMS line is connected. A failed
   notification never breaks the job action that caused it. */

/* PUSH-BEGIN (pure Web Push crypto, standard protocol: VAPID
   ES256 JWT plus aes128gcm payload encryption, RFC 8291 and
   RFC 8188. The test harness lifts this section out and
   round-trips it in Node.) */
function b64UrlToBytes(s) {
  const b64 = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToB64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concatBytes(...parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
async function hkdfDerive(ikm, salt, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}
async function vapidSigningKey(privateB64Url, publicB64Url) {
  const pub = b64UrlToBytes(publicB64Url);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64Url(pub.slice(1, 33)),
    y: bytesToB64Url(pub.slice(33, 65)),
    d: privateB64Url,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
async function createVapidJwt(audience, subject, privateB64Url, publicB64Url) {
  const enc = new TextEncoder();
  const header = bytesToB64Url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64Url(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const signingInput = `${header}.${payload}`;
  const key = await vapidSigningKey(privateB64Url, publicB64Url);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput));
  return `${signingInput}.${bytesToB64Url(new Uint8Array(sig))}`;
}
async function encryptPushPayload(p256dhB64Url, authB64Url, plaintext) {
  const uaPublic = b64UrlToBytes(p256dhB64Url);
  const authSecret = b64UrlToBytes(authB64Url);
  const serverPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverPair.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, serverPair.privateKey, 256));
  const enc = new TextEncoder();
  const ikm = await hkdfDerive(shared, authSecret, concatBytes(enc.encode("WebPush: info\0"), uaPublic, serverPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdfDerive(ikm, salt, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfDerive(ikm, salt, enc.encode("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const record = concatBytes(plaintext, new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, record));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concatBytes(salt, rs, new Uint8Array([serverPublic.length]), serverPublic, cipher);
}
/* PUSH-END */

async function sendWebPush(env, sub, payloadText) {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  try {
    const endpoint = new URL(sub.endpoint);
    const jwt = await createVapidJwt(endpoint.origin, "mailto:contact@bjvfi.com", privateKey, publicKey);
    const body = await encryptPushPayload(sub.p256dh, sub.auth, new TextEncoder().encode(payloadText));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let resp;
    try {
      resp = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          authorization: `vapid t=${jwt}, k=${publicKey}`,
          "content-encoding": "aes128gcm",
          "content-type": "application/octet-stream",
          ttl: "86400",
        },
        body,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    /* A push service that says the subscription is gone (404 or
       410) loses it here; any other failure keeps it. */
    if (resp.status === 404 || resp.status === 410) {
      await runSql(env, "DELETE FROM push_subscriptions WHERE id = ?", [sub.id]);
    }
  } catch {
    /* A failed push never breaks the job action. */
  }
}

function jobMoneyText(job) {
  if (job.budget_amount == null) return null;
  const sym = job.budget_currency === "LRD" ? "LD " : "$";
  return `${sym}${Number(job.budget_amount).toLocaleString("en-US")}`;
}

function completedNotificationText(job) {
  const amt = jobMoneyText(job);
  return amt ? `Job done: ${job.title}. Jackwork sent ${amt} to your Mobile Money` : `Job done: ${job.title}`;
}

async function notifyJobEvent(env, profileId, job, kind, text) {
  if (!profileId) return;
  try {
    const res = await runSql(
      env,
      "INSERT INTO notifications (profile_id, job_id, kind, text, sms_status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [profileId, job?.id ?? null, kind, text, smsConfigured() ? "pending" : "waiting_for_line", Date.now()],
    );
    if (smsConfigured()) {
      const target = await firstRow(env, "SELECT phone FROM profiles WHERE id = ?", [profileId]);
      if (target?.phone) {
        const st = await sendNotificationSms(target.phone, text);
        await runSql(env, "UPDATE notifications SET sms_status = ? WHERE id = ?", [st, res.meta.last_row_id]);
      }
    }
    const subs = await allRows(env, "SELECT * FROM push_subscriptions WHERE profile_id = ?", [profileId]);
    for (const s of subs) {
      await sendWebPush(env, s, JSON.stringify({ text, jobId: job?.id ?? null }));
    }
  } catch {
    /* Notifications never break the job action that caused them. */
  }
}

const PROOF_MIMES = ["image/", "video/", "audio/"];

function toProfile(row) {
  // The ID document itself (number and photo) is NOT part of the profile
  // payload. Only the session holder can fetch it, via getMyIdDocument.
  let workPreferences = [];
  try {
    const v = row.work_preferences ? JSON.parse(row.work_preferences) : [];
    workPreferences = Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    workPreferences = [];
  }
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    location: row.location,
    address: row.address,
    dateOfBirth: row.date_of_birth ?? null,
    idType: row.id_type ?? null,
    hasIdOnFile: !!row.id_blob_key,
    profileImageUrl: row.profile_blob_key ? blobUrl(row.profile_blob_key) : null,
    county: row.county ?? null,
    district: row.district ?? null,
    city: row.city ?? null,
    community: row.community ?? (row.address ? row.address : null),
    houseDirections: row.house_directions ?? null,
    mobileMoneyNumber: row.mobile_money_number ?? null,
    workPreferences,
    workPrefsAnswered: row.work_prefs_answered === 1,
    termsVersion: row.terms_version ?? null,
    termsRole: row.terms_role ?? null,
    termsAgreed: row.terms_agreed_at != null && (row.terms_version ?? 0) >= 1,
    verificationStatus: row.verification_status,
    offersServices: row.offers_services === 1,
    gpsLat: row.gps_lat ?? null,
    gpsLng: row.gps_lng ?? null,
    placeLat: row.place_lat ?? null,
    placeLng: row.place_lng ?? null,
    tradeCategory: row.trade_category ?? null,
    bio: row.bio,
    yearsExperience: row.years_experience ?? null,
    available: row.available === 1,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const ID_TYPES = [
  "National ID",
  "Voter ID",
  "Passport",
  "Driver license",
  "Work ID",
  "School ID",
  "Other ID",
];

/* ---------------- actions ---------------- */

const Actions = {
  async getOverview(env) {
    const jobRows = await allRows(env, "SELECT status, COUNT(*) AS n FROM jobs GROUP BY status");
    const profRows = await allRows(
      env,
      "SELECT verification_status, offers_services, available, COUNT(*) AS n FROM profiles GROUP BY verification_status, offers_services, available",
    );
    let openJobs = 0, totalJobs = 0, completedJobs = 0;
    for (const r of jobRows) {
      totalJobs += r.n;
      if (r.status === "open") openJobs = r.n;
      if (r.status === "completed") completedJobs = r.n;
    }
    let totalProfiles = 0, verifiedProfiles = 0, totalWorkers = 0, availableWorkers = 0;
    for (const r of profRows) {
      totalProfiles += r.n;
      if (r.verification_status === "verified") verifiedProfiles += r.n;
      if (r.offers_services === 1) {
        totalWorkers += r.n;
        if (r.available === 1) availableWorkers += r.n;
      }
    }
    return { openJobs, totalJobs, completedJobs, totalProfiles, verifiedProfiles, totalWorkers, availableWorkers };
  },

  async getMyProfile(env, args) {
    const phone = reqStr(args.phone, "phone", 6, 30);
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const rows = await allRows(env, "SELECT * FROM profiles ORDER BY id DESC");
    const mine = rows.find((r) => samePhone(r.phone, phone));
    if (!mine) return { profile: null };
    if (!mine.session_token || mine.session_token !== sessionToken) return { profile: null };
    return { profile: toProfile(mine) };
  },

  async getMyIdDocument(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const p = await firstRow(env, "SELECT * FROM profiles WHERE id = ?", [profileId]);
    if (!p || !p.session_token || p.session_token !== sessionToken) {
      return { ok: false, idType: null, idNumberTail: null, idImageUrl: null };
    }
    return {
      ok: true,
      idType: p.id_type ?? null,
      idNumberTail: p.id_number ? p.id_number.slice(-3) : null,
      idImageUrl: p.id_blob_key ? blobUrl(p.id_blob_key) : null,
    };
  },

  async createProfile(env, args) {
    const fullName = reqStr(args.fullName, "fullName", 2, 80);
    const phone = reqStr(args.phone, "phone", 6, 30);
    const location = reqStr(args.location, "location", 2, 120);
    const address = optStr(args.address, "address", 200, "");
    const county = optStr(args.county, "county", 60, undefined);
    const district = optStr(args.district, "district", 80, undefined);
    const city = optStr(args.city, "city", 80, undefined);
    const dateOfBirth = optStr(args.dateOfBirth, "dateOfBirth", 20, undefined);
    const offersServices = optBool(args.offersServices, false);
    const tradeCategory = optStr(args.tradeCategory, "tradeCategory", 60, undefined);
    const bio = optStr(args.bio, "bio", 600, "");
    const yearsExperience = optInt(args.yearsExperience, "yearsExperience", 0, 60);
    const rows = await allRows(env, "SELECT phone FROM profiles");
    if (rows.some((r) => samePhone(r.phone, phone))) {
      return { id: 0, error: "A profile with this phone number already exists. One person, one profile." };
    }
    const now = Date.now();
    const res = await runSql(
      env,
      `INSERT INTO profiles (full_name, phone, location, address, county, district, city,
         date_of_birth, offers_services, trade_category, bio, years_experience, available,
         verification_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'unverified', ?, ?)`,
      [
        fullName.trim(),
        phone.trim(),
        location.trim(),
        address.trim(),
        county?.trim() ? county.trim() : null,
        district?.trim() ? district.trim() : null,
        city?.trim() ? city.trim() : null,
        dateOfBirth?.trim() ? dateOfBirth.trim() : null,
        offersServices ? 1 : 0,
        offersServices && tradeCategory ? tradeCategory : null,
        bio.trim(),
        yearsExperience,
        now,
        now,
      ],
    );
    return { id: res.meta.last_row_id, error: null };
  },

  async uploadIdDocument(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    if (!ID_TYPES.includes(args.idType)) throw bad("Invalid idType.");
    const idNumber = reqStr(args.idNumber, "idNumber", 3, 60);
    const dataBase64 = reqStr(args.dataBase64, "dataBase64", 10, 30000000);
    const mimeType = reqStr(args.mimeType, "mimeType", 3, 60);
    if (!mimeType.startsWith("image/")) {
      return { ok: false, error: "Please upload a photo of the ID (image file)." };
    }
    const p = await firstRow(env, "SELECT id FROM profiles WHERE id = ?", [profileId]);
    if (!p) return { ok: false, error: "Profile not found." };
    const key = `id-documents/profile-${profileId}`;
    const bytes = base64ToBytes(dataBase64);
    await runSql(env, "INSERT OR REPLACE INTO blobs (key, mime, data, created_at) VALUES (?, ?, ?, ?)", [
      key,
      mimeType,
      bytes,
      Date.now(),
    ]);
    await runSql(
      env,
      "UPDATE profiles SET id_type = ?, id_number = ?, id_blob_key = ?, id_mime = ?, verification_status = 'pending', updated_at = ? WHERE id = ?",
      [args.idType, idNumber.trim(), key, mimeType, Date.now(), profileId],
    );
    return { ok: true, error: null };
  },

  async confirmVerification(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    const p = await firstRow(env, "SELECT * FROM profiles WHERE id = ?", [profileId]);
    if (!p) return { ok: false, error: "Profile not found." };
    if (!p.id_blob_key) return { ok: false, error: "Upload your ID document first." };
    await runSql(env, "UPDATE profiles SET verification_status = 'verified', updated_at = ? WHERE id = ?", [
      Date.now(),
      profileId,
    ]);
    return { ok: true, error: null };
  },

  async updateWorkProfile(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    if (typeof args.offersServices !== "boolean") throw bad("Invalid offersServices.");
    const tradeCategory = optStr(args.tradeCategory, "tradeCategory", 60, undefined);
    const bio = optStr(args.bio, "bio", 600, "");
    const yearsExperience = optInt(args.yearsExperience, "yearsExperience", 0, 60);
    const available = optBool(args.available, true);
    await runSql(
      env,
      "UPDATE profiles SET offers_services = ?, trade_category = ?, bio = ?, years_experience = ?, available = ?, updated_at = ? WHERE id = ?",
      [
        args.offersServices ? 1 : 0,
        args.offersServices && tradeCategory ? tradeCategory : null,
        bio.trim(),
        yearsExperience,
        available ? 1 : 0,
        Date.now(),
        profileId,
      ],
    );
    return { ok: true };
  },

  async updateProfileDetails(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    const fullName = reqStr(args.fullName, "fullName", 2, 80);
    const location = reqStr(args.location, "location", 2, 120);
    const address = optStr(args.address, "address", 200, "");
    await runSql(env, "UPDATE profiles SET full_name = ?, location = ?, address = ?, updated_at = ? WHERE id = ?", [
      fullName.trim(),
      location.trim(),
      address.trim(),
      Date.now(),
      profileId,
    ]);
    return { ok: true };
  },

  async updateHomeLocation(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    const county = reqStr(args.county, "county", 2, 60);
    const district = optStr(args.district, "district", 80, "");
    const city = reqStr(args.city, "city", 2, 80);
    const communityIn = optStr(args.community, "community", 120, undefined);
    const houseDirections = optStr(args.houseDirections, "houseDirections", 300, undefined);
    const placeLat = optNum(args.placeLat, "placeLat", -90, 90);
    const placeLng = optNum(args.placeLng, "placeLng", -180, 180);
    const location = [city.trim(), county.trim()].filter(Boolean).join(", ");
    const community = communityIn?.trim() ? communityIn.trim() : null;
    if (houseDirections !== undefined) {
      await runSql(
        env,
        `UPDATE profiles SET county = ?, district = ?, city = ?, community = ?, house_directions = ?,
           location = ?, address = ?, place_lat = ?, place_lng = ?, updated_at = ? WHERE id = ?`,
        [
          county.trim(),
          district.trim() || null,
          city.trim(),
          community,
          houseDirections.trim() || null,
          location,
          community ?? "",
          placeLat,
          placeLng,
          Date.now(),
          profileId,
        ],
      );
    } else {
      await runSql(
        env,
        `UPDATE profiles SET county = ?, district = ?, city = ?, community = ?,
           location = ?, address = ?, place_lat = ?, place_lng = ?, updated_at = ? WHERE id = ?`,
        [
          county.trim(),
          district.trim() || null,
          city.trim(),
          community,
          location,
          community ?? "",
          placeLat,
          placeLng,
          Date.now(),
          profileId,
        ],
      );
    }
    return { ok: true };
  },

  async uploadProfilePhoto(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    const dataBase64 = reqStr(args.dataBase64, "dataBase64", 10, 30000000);
    const mimeType = reqStr(args.mimeType, "mimeType", 3, 60);
    if (!mimeType.startsWith("image/")) {
      return { ok: false, error: "Please pick a photo (image file)." };
    }
    const p = await firstRow(env, "SELECT id FROM profiles WHERE id = ?", [profileId]);
    if (!p) return { ok: false, error: "Profile not found." };
    const key = `profile-photos/profile-${profileId}`;
    const bytes = base64ToBytes(dataBase64);
    await runSql(env, "INSERT OR REPLACE INTO blobs (key, mime, data, created_at) VALUES (?, ?, ?, ?)", [
      key,
      mimeType,
      bytes,
      Date.now(),
    ]);
    await runSql(env, "UPDATE profiles SET profile_blob_key = ?, profile_mime = ?, updated_at = ? WHERE id = ?", [
      key,
      mimeType,
      Date.now(),
      profileId,
    ]);
    return { ok: true, error: null };
  },

  async listWorkers(env, args) {
    const category = optStr(args.category, "category", 200, undefined);
    let limit = 100;
    if (args.limit !== undefined && args.limit !== null) {
      if (typeof args.limit !== "number" || !Number.isInteger(args.limit) || args.limit <= 0 || args.limit > 200) {
        throw bad("Invalid limit.");
      }
      limit = args.limit;
    }
    const rows = category
      ? await allRows(env, "SELECT * FROM profiles WHERE offers_services = 1 AND trade_category = ? ORDER BY id DESC LIMIT ?", [category, limit])
      : await allRows(env, "SELECT * FROM profiles WHERE offers_services = 1 ORDER BY id DESC LIMIT ?", [limit]);
    const done = await allRows(env, "SELECT provider_id, provider_phone, rating FROM jobs WHERE status = 'completed'");
    const workers = rows.map((p) => {
      const mine = done.filter(
        (j) => j.provider_id === p.id || (j.provider_id == null && j.provider_phone === p.phone),
      );
      const rated = mine.filter((j) => j.rating != null);
      const avg = rated.length
        ? Math.round((rated.reduce((s, j) => s + (j.rating ?? 0), 0) / rated.length) * 10) / 10
        : null;
      return {
        id: p.id,
        name: p.full_name,
        category: p.trade_category ?? "Other",
        location: p.location,
        bio: p.bio,
        yearsExperience: p.years_experience ?? null,
        available: p.available === 1,
        verificationStatus: p.verification_status,
        jobsCompleted: mine.length,
        avgRating: avg,
        createdAt: new Date(p.created_at).toISOString(),
      };
    });
    return { workers };
  },

  /* Sign-in: name + phone + code, no password. On this test launch the
     code is returned for on-screen delivery until a live texting line is
     connected. Same behavior as the Space build. */
  async requestSignInCode(env, args) {
    const phone = reqStr(args.phone, "phone", 6, 30);
    const all = await allRows(env, "SELECT phone FROM profiles");
    const profileExists = all.some((r) => samePhone(r.phone, phone));
    const old = await allRows(env, "SELECT id, phone FROM signin_codes WHERE used = 0");
    for (const row of old) {
      if (samePhone(row.phone, phone)) {
        await runSql(env, "UPDATE signin_codes SET used = 1 WHERE id = ?", [row.id]);
      }
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const now = Date.now();
    await runSql(env, "INSERT INTO signin_codes (phone, code, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)", [
      phone.trim(),
      code,
      now + 10 * 60 * 1000,
      now,
    ]);
    return { sent: true, deliveredCode: code, profileExists };
  },

  async verifySignInCode(env, args) {
    const phone = reqStr(args.phone, "phone", 6, 30);
    const code = reqStr(args.code, "code", 4, 8);
    const name = optStr(args.name, "name", 80, "");
    const codes = await allRows(env, "SELECT * FROM signin_codes WHERE used = 0 ORDER BY id DESC");
    const match = codes.find((r) => samePhone(r.phone, phone) && r.code === code.trim());
    if (!match) {
      return { ok: false, error: "That code is not right. Check it and try again, or send a new code.", profileId: null, sessionToken: null };
    }
    if (match.expires_at < Date.now()) {
      return { ok: false, error: "That code has expired. Send a new one.", profileId: null, sessionToken: null };
    }
    await runSql(env, "UPDATE signin_codes SET used = 1 WHERE id = ?", [match.id]);
    const sessionToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const all = await allRows(env, "SELECT * FROM profiles ORDER BY id DESC");
    const existing = all.find((r) => samePhone(r.phone, phone));
    if (existing) {
      await runSql(env, "UPDATE profiles SET session_token = ?, updated_at = ? WHERE id = ?", [
        sessionToken,
        Date.now(),
        existing.id,
      ]);
      return { ok: true, error: null, profileId: existing.id, sessionToken };
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return { ok: false, error: "Enter your name so people know who they are dealing with.", profileId: null, sessionToken: null };
    }
    const now = Date.now();
    const res = await runSql(
      env,
      `INSERT INTO profiles (full_name, phone, location, address, offers_services, bio, available,
         verification_status, session_token, created_at, updated_at)
       VALUES (?, ?, '', '', 0, '', 1, 'unverified', ?, ?, ?)`,
      [trimmedName, phone.trim(), sessionToken, now, now],
    );
    return { ok: true, error: null, profileId: res.meta.last_row_id, sessionToken };
  },

  async listJobs(env, args) {
    await autoCompleteDueJobs(env);
    const status = optStr(args.status, "status", 40, undefined);
    const category = optStr(args.category, "category", 200, undefined);
    let limit = 100;
    if (args.limit !== undefined && args.limit !== null) {
      if (typeof args.limit !== "number" || !Number.isInteger(args.limit) || args.limit <= 0 || args.limit > 200) {
        throw bad("Invalid limit.");
      }
      limit = args.limit;
    }
    const viewerSessionToken = optStr(args.viewerSessionToken, "viewerSessionToken", 300, undefined);
    if (viewerSessionToken !== undefined && viewerSessionToken.length < 10) {
      throw bad("Invalid viewerSessionToken.");
    }
    const conds = [];
    const params = [];
    if (status) { conds.push("status = ?"); params.push(status); }
    if (category) { conds.push("category = ?"); params.push(category); }
    const rows = await allRows(
      env,
      `SELECT * FROM jobs ${conds.length ? "WHERE " + conds.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`,
      [...params, limit],
    );
    // The viewer is proven by the session token server-side, never from a
    // caller-supplied id. Private job parts go only to the poster and the
    // worker who accepted the job.
    let viewerId = null;
    let viewerPhone = "";
    if (viewerSessionToken) {
      const vp = await firstRow(env, "SELECT id, phone FROM profiles WHERE session_token = ?", [viewerSessionToken]);
      if (vp) {
        viewerId = vp.id;
        viewerPhone = vp.phone;
      }
    }
    const partyRole = (j) => {
      if (viewerId == null) return false;
      if (j.customer_profile_id === viewerId || (j.customer_phone && samePhone(j.customer_phone, viewerPhone))) return "poster";
      if (j.provider_id === viewerId || (j.provider_phone && samePhone(j.provider_phone, viewerPhone))) return "worker";
      return false;
    };
    return { jobs: rows.map((j) => toJob(j, partyRole(j))) };
  },

  async createJob(env, args) {
    const title = reqStr(args.title, "title", 3, 120);
    const category = reqStr(args.category, "category", 1, 200);
    const description = reqStr(args.description, "description", 10, 2000);
    const location = reqStr(args.location, "location", 2, 120);
    const landmark = optStr(args.landmark, "landmark", 200, undefined);
    const budgetAmount = args.budgetAmount === undefined || args.budgetAmount === null
      ? null
      : optInt(args.budgetAmount, "budgetAmount", 1, 100000000);
    const budgetCurrency = args.budgetCurrency === undefined || args.budgetCurrency === null ? "USD" : args.budgetCurrency;
    if (budgetCurrency !== "USD" && budgetCurrency !== "LRD") throw bad("Invalid budgetCurrency.");
    const budgetType = optStr(args.budgetType, "budgetType", 60, "Fixed price");
    const urgency = optStr(args.urgency, "urgency", 60, "Right now");
    const scheduledDate = optStr(args.scheduledDate, "scheduledDate", 10, undefined);
    if (scheduledDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) throw bad("Invalid scheduledDate.");
    const scheduledTime = optStr(args.scheduledTime, "scheduledTime", 10, undefined);
    if (scheduledTime !== undefined && !/^\d{1,2}:\d{2}\s(AM|PM)$/.test(scheduledTime)) throw bad("Invalid scheduledTime.");
    const houseDirections = optStr(args.houseDirections, "houseDirections", 300, undefined);
    const customerName = reqStr(args.customerName, "customerName", 2, 80);
    const customerPhone = reqStr(args.customerPhone, "customerPhone", 6, 30);
    const contactPhone = optStr(args.contactPhone, "contactPhone", 30, undefined);
    const task = optStr(args.task, "task", 120, undefined);
    const customerProfileId = args.customerProfileId === undefined || args.customerProfileId === null
      ? null
      : reqId(args.customerProfileId, "customerProfileId");
    const gpsLat = optNum(args.gpsLat, "gpsLat", -90, 90);
    const gpsLng = optNum(args.gpsLng, "gpsLng", -180, 180);
    const placeLat = optNum(args.placeLat, "placeLat", -90, 90);
    const placeLng = optNum(args.placeLng, "placeLng", -180, 180);
    const payMethod = args.payMethod === undefined || args.payMethod === null ? "Mobile Money" : args.payMethod;
    if (payMethod !== "Mobile Money") throw bad("Invalid payMethod.");
    const now = Date.now();
    const res = await runSql(
      env,
      `INSERT INTO jobs (title, category, description, location, landmark, budget_amount,
         budget_currency, budget_type, urgency, scheduled_date, scheduled_time, house_directions,
         customer_name, customer_phone, contact_phone, task, customer_profile_id, gps_lat, gps_lng,
         place_lat, place_lng, pay_method, status, payment_state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'waiting', ?, ?)`,
      [
        title.trim(),
        category,
        description.trim(),
        location.trim(),
        landmark?.trim() ? landmark.trim() : null,
        budgetAmount,
        budgetCurrency,
        budgetType,
        urgency,
        scheduledDate ?? null,
        scheduledTime ?? null,
        houseDirections?.trim() ? houseDirections.trim() : null,
        customerName.trim(),
        customerPhone.trim(),
        contactPhone?.trim() ? contactPhone.trim() : null,
        task?.trim() ? task.trim() : null,
        customerProfileId,
        gpsLat,
        gpsLng,
        placeLat,
        placeLng,
        payMethod,
        now,
        now,
      ],
    );
    return { id: res.meta.last_row_id };
  },

  async acceptJob(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const providerProfileId = reqId(args.providerProfileId, "providerProfileId");
    const providerSessionToken = reqStr(args.providerSessionToken, "providerSessionToken", 10, 300);
    const actor = await actorForToken(env, providerSessionToken);
    if (!actor || actor.id !== providerProfileId) {
      return { ok: false, error: "Sign in again, then accept the job." };
    }
    const job = await jobForId(env, jobId);
    if (!job) return { ok: false, error: "That job no longer exists." };
    if (job.status !== "open") return { ok: false, error: "This job was just taken." };
    if (job.customer_profile_id === actor.id || samePhone(job.customer_phone, actor.phone)) {
      return { ok: false, error: "You cannot accept your own job." };
    }
    /* First come takes it, enforced in the database: the claim is
       one conditional update that only lands while the job is
       still open, so two accepts at the same moment cannot both
       win. The loser changes zero rows and is told plainly. */
    const claim = await runSql(
      env,
      `UPDATE jobs SET status = 'accepted', provider_name = ?, provider_phone = ?, provider_id = ?,
         payment_state = 'waiting', updated_at = ? WHERE id = ? AND status = 'open'`,
      [actor.full_name, actor.phone, actor.id, Date.now(), jobId],
    );
    if (!claim.meta || claim.meta.changes !== 1) {
      return { ok: false, error: "This job was just taken." };
    }
    await notifyJobEvent(env, job.customer_profile_id, job, "accepted", `A worker accepted your job: ${job.title}`);
    return { ok: true, error: null };
  },

  async confirmJobAfterCall(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const actor = await actorForToken(env, sessionToken);
    const job = await jobForId(env, jobId);
    if (!actor || !job) return { ok: false, error: "That job no longer exists." };
    if (!isWorker(job, actor)) return { ok: false, error: "Only the worker on this job can confirm it." };
    if (job.status !== "accepted") return { ok: false, error: "This job is not waiting for your call confirmation." };
    const now = Date.now();
    await runSql(env, "UPDATE jobs SET status = 'confirmed', worker_confirmed_at = ?, updated_at = ? WHERE id = ?", [now, now, jobId]);
    await notifyJobEvent(env, job.customer_profile_id, job, "confirmed", `The worker confirmed your job: ${job.title}`);
    return { ok: true, error: null };
  },

  async proposeJobPrice(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const amount = optInt(args.amount, "amount", 1, 100000000);
    if (amount === null) throw bad("Invalid amount.");
    const actor = await actorForToken(env, sessionToken);
    const job = await jobForId(env, jobId);
    if (!actor || !job) return { ok: false, error: "That job no longer exists." };
    if (!isWorker(job, actor)) return { ok: false, error: "Only the worker on this job can change the price." };
    if (job.status !== "accepted") return { ok: false, error: "The price can only be changed right after the call." };
    const now = Date.now();
    await runSql(
      env,
      `UPDATE jobs SET status = 'price_proposed', worker_confirmed_at = ?, proposed_budget_amount = ?,
         price_proposed_at = ?, updated_at = ? WHERE id = ?`,
      [now, amount, now, now, jobId],
    );
    const proposedText = jobMoneyText({ budget_amount: amount, budget_currency: job.budget_currency });
    await notifyJobEvent(
      env,
      job.customer_profile_id,
      job,
      "price_proposed",
      proposedText
        ? `The worker proposed a new price, ${proposedText}, for your job: ${job.title}`
        : `The worker proposed a new price for your job: ${job.title}`,
    );
    return { ok: true, error: null };
  },

  async respondToJobPrice(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    if (typeof args.accept !== "boolean") throw bad("Invalid accept.");
    const actor = await actorForToken(env, sessionToken);
    const job = await jobForId(env, jobId);
    if (!actor || !job) return { ok: false, error: "That job no longer exists." };
    if (!isPoster(job, actor)) return { ok: false, error: "Only the person who posted this job can answer the new price." };
    if (job.status !== "price_proposed" || job.proposed_budget_amount == null) {
      return { ok: false, error: "This job is not waiting on a new price." };
    }
    const now = Date.now();
    const workerId = job.provider_id;
    if (args.accept) {
      await runSql(
        env,
        `UPDATE jobs SET status = 'confirmed', budget_amount = ?, proposed_budget_amount = NULL,
           price_proposed_at = NULL, updated_at = ? WHERE id = ?`,
        [job.proposed_budget_amount, now, jobId],
      );
      await notifyJobEvent(env, workerId, job, "price_accepted", `Your new price was accepted for the job: ${job.title}`);
    } else {
      await runSql(
        env,
        `UPDATE jobs SET status = 'open', provider_name = NULL, provider_phone = NULL, provider_id = NULL,
           worker_confirmed_at = NULL, proposed_budget_amount = NULL, price_proposed_at = NULL,
           payment_state = 'waiting', payment_marked_at = NULL, updated_at = ? WHERE id = ?`,
        [now, jobId],
      );
      await notifyJobEvent(env, workerId, job, "price_declined", `The poster said no to your new price, and the job is open again: ${job.title}`);
    }
    return { ok: true, error: null };
  },

  async markMobileMoneySent(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const actor = await actorForToken(env, sessionToken);
    const job = await jobForId(env, jobId);
    if (!actor || !job) return { ok: false, error: "That job no longer exists." };
    if (!isPoster(job, actor)) return { ok: false, error: "Only the person who posted this job can send the Mobile Money." };
    if (job.status !== "confirmed" || (job.payment_state ?? "waiting") !== "waiting") {
      return { ok: false, error: "This job is not waiting for Mobile Money." };
    }
    const now = Date.now();
    await runSql(
      env,
      "UPDATE jobs SET status = 'held', payment_state = 'held', payment_marked_at = ?, updated_at = ? WHERE id = ?",
      [now, now, jobId],
    );
    await notifyJobEvent(env, job.provider_id, job, "money_held", `Jackwork has the money for the job: ${job.title}`);
    return { ok: true, error: null };
  },

  async startJob(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const actor = await actorForToken(env, sessionToken);
    const job = await jobForId(env, jobId);
    if (!actor || !job) return { ok: false, error: "That job no longer exists." };
    if (!isWorker(job, actor)) return { ok: false, error: "Only the worker on this job can start it." };
    if (job.status !== "held" || job.payment_state !== "held") {
      return { ok: false, error: "Jackwork must have the money before work starts." };
    }
    let key = null;
    let mime = null;
    if (args.dataBase64 !== undefined || args.mimeType !== undefined) {
      const dataBase64 = reqStr(args.dataBase64, "dataBase64", 10, 30000000);
      mime = reqStr(args.mimeType, "mimeType", 3, 80);
      if (!PROOF_MIMES.some((p) => mime.startsWith(p))) {
        return { ok: false, error: "Proof must be a picture, a video, or a recording." };
      }
      key = `job-proofs/job-${jobId}-before`;
      const bytes = base64ToBytes(dataBase64);
      await runSql(env, "INSERT OR REPLACE INTO blobs (key, mime, data, created_at) VALUES (?, ?, ?, ?)", [key, mime, bytes, Date.now()]);
    }
    await runSql(
      env,
      "UPDATE jobs SET status = 'in_progress', before_proof_blob_key = ?, before_proof_mime = ?, updated_at = ? WHERE id = ?",
      [key, mime, Date.now(), jobId],
    );
    await notifyJobEvent(env, job.customer_profile_id, job, "started", `The worker started your job: ${job.title}`);
    return { ok: true, error: null };
  },

  async finishJob(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const actor = await actorForToken(env, sessionToken);
    const job = await jobForId(env, jobId);
    if (!actor || !job) return { ok: false, error: "That job no longer exists." };
    if (!isWorker(job, actor)) return { ok: false, error: "Only the worker on this job can mark it done." };
    if (job.status !== "in_progress") return { ok: false, error: "This job is not being worked on." };
    let key = null;
    let mime = null;
    if (args.dataBase64 !== undefined || args.mimeType !== undefined) {
      const dataBase64 = reqStr(args.dataBase64, "dataBase64", 10, 30000000);
      mime = reqStr(args.mimeType, "mimeType", 3, 80);
      if (!PROOF_MIMES.some((p) => mime.startsWith(p))) {
        return { ok: false, error: "Proof must be a picture, a video, or a recording." };
      }
      key = `job-proofs/job-${jobId}-after`;
      const bytes = base64ToBytes(dataBase64);
      await runSql(env, "INSERT OR REPLACE INTO blobs (key, mime, data, created_at) VALUES (?, ?, ?, ?)", [key, mime, bytes, Date.now()]);
    }
    const now = Date.now();
    await runSql(
      env,
      `UPDATE jobs SET status = 'worker_done', worker_done_at = ?, after_proof_blob_key = ?,
         after_proof_mime = ?, updated_at = ? WHERE id = ?`,
      [now, key, mime, now, jobId],
    );
    await notifyJobEvent(env, job.customer_profile_id, job, "worker_done", `The worker says your job is done: ${job.title}`);
    return { ok: true, error: null };
  },

  async confirmJobDone(env, args) {
    await autoCompleteDueJobs(env);
    const jobId = reqId(args.jobId, "jobId");
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const actor = await actorForToken(env, sessionToken);
    const job = await jobForId(env, jobId);
    if (!actor || !job) return { ok: false, error: "That job no longer exists." };
    if (!isPoster(job, actor)) return { ok: false, error: "Only the person who posted this job can confirm it is done." };
    if (job.status !== "worker_done") return { ok: false, error: "The worker has not marked this job done yet." };
    const now = Date.now();
    await runSql(
      env,
      `UPDATE jobs SET status = 'completed', payment_state = 'paid', poster_confirmed_at = ?,
         completed_at = ?, auto_completed = 0, updated_at = ? WHERE id = ?`,
      [now, now, now, jobId],
    );
    await notifyJobEvent(env, job.provider_id, job, "completed", completedNotificationText(job));
    return { ok: true, error: null };
  },

  async reportJobProblem(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const actor = await actorForToken(env, sessionToken);
    const job = await jobForId(env, jobId);
    if (!actor || !job) return { ok: false, error: "That job no longer exists." };
    const poster = isPoster(job, actor);
    const worker = isWorker(job, actor);
    if (!poster && !worker) return { ok: false, error: "Only the people on this job can report a problem." };
    if (!["price_proposed", "confirmed", "held", "in_progress", "worker_done"].includes(job.status)) {
      return { ok: false, error: "A problem can be reported once the job is confirmed." };
    }
    const now = Date.now();
    await runSql(
      env,
      "UPDATE jobs SET problem_reported = 1, problem_by = ?, problem_at = ?, updated_at = ? WHERE id = ?",
      [poster ? "poster" : "worker", now, now, jobId],
    );
    await notifyJobEvent(
      env,
      poster ? job.provider_id : job.customer_profile_id,
      job,
      "problem",
      `A problem was reported on the job: ${job.title}`,
    );
    return { ok: true, error: null };
  },

  async updateJobStatus(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    if (!["open", "cancelled"].includes(args.status)) {
      throw bad("Invalid status.");
    }
    const job = await jobForId(env, jobId);
    if (!job) return { ok: true };
    if (args.status === "open") {
      if (!["accepted", "confirmed"].includes(job.status)) return { ok: true };
      await runSql(
        env,
        `UPDATE jobs SET status = 'open', provider_name = NULL, provider_phone = NULL, provider_id = NULL,
           worker_confirmed_at = NULL, payment_state = 'waiting', payment_marked_at = NULL, updated_at = ? WHERE id = ?`,
        [Date.now(), jobId],
      );
    } else {
      if (!["open", "accepted", "confirmed", "held"].includes(job.status)) return { ok: true };
      await runSql(env, "UPDATE jobs SET status = 'cancelled', updated_at = ? WHERE id = ?", [Date.now(), jobId]);
    }
    return { ok: true };
  },

  async rateJob(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const rating = optInt(args.rating, "rating", 1, 5);
    if (rating === null) throw bad("Invalid rating.");
    const review = optStr(args.review, "review", 500, undefined);
    await runSql(env, "UPDATE jobs SET rating = ?, review = ?, updated_at = ? WHERE id = ?", [
      rating,
      review?.trim() ? review.trim() : null,
      Date.now(),
      jobId,
    ]);
    return { ok: true };
  },

  async rateCustomer(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    const rating = optInt(args.rating, "rating", 1, 5);
    if (rating === null) throw bad("Invalid rating.");
    const review = optStr(args.review, "review", 500, undefined);
    await runSql(env, "UPDATE jobs SET rating_by_provider = ?, review_by_provider = ?, updated_at = ? WHERE id = ?", [
      rating,
      review?.trim() ? review.trim() : null,
      Date.now(),
      jobId,
    ]);
    return { ok: true };
  },

  async setMyLocation(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    const lat = optNum(args.lat, "lat", -90, 90);
    const lng = optNum(args.lng, "lng", -180, 180);
    if (lat === null || lng === null) throw bad("Invalid coordinates.");
    await runSql(env, "UPDATE profiles SET gps_lat = ?, gps_lng = ?, updated_at = ? WHERE id = ?", [
      lat,
      lng,
      Date.now(),
      profileId,
    ]);
    return { ok: true };
  },

  async getProfileStats(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    const done = await allRows(env, "SELECT * FROM jobs WHERE status = 'completed'");
    const asWorker = done.filter((j) => j.provider_id === profileId);
    const asCustomer = done.filter((j) => j.customer_profile_id === profileId);
    const wRated = asWorker.filter((j) => j.rating != null);
    const cRated = asCustomer.filter((j) => j.rating_by_provider != null);
    const avg = (rows, pick) =>
      rows.length ? Math.round((rows.reduce((sum, j) => sum + (pick(j) ?? 0), 0) / rows.length) * 10) / 10 : null;
    return {
      jobsDone: asWorker.length,
      jobsPosted: asCustomer.length,
      workerAvg: avg(wRated, (j) => j.rating),
      workerRatingCount: wRated.length,
      customerAvg: avg(cRated, (j) => j.rating_by_provider),
      customerRatingCount: cRated.length,
    };
  },

  async deleteJob(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    await runSql(env, "DELETE FROM jobs WHERE id = ?", [jobId]);
    return { ok: true };
  },

  async updateMobileMoney(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    const number = reqStr(args.number, "number", 6, 30);
    await runSql(env, "UPDATE profiles SET mobile_money_number = ?, updated_at = ? WHERE id = ?", [
      number.trim(),
      Date.now(),
      profileId,
    ]);
    return { ok: true };
  },

  async updateWorkPreferences(env, args) {
    const profileId = reqId(args.profileId, "profileId");
    if (!Array.isArray(args.preferences) || args.preferences.length > 40) {
      throw bad("Invalid preferences.");
    }
    for (const p of args.preferences) {
      if (typeof p !== "string" || p.length > 60) throw bad("Invalid preferences.");
    }
    await runSql(env, "UPDATE profiles SET work_preferences = ?, work_prefs_answered = 1, updated_at = ? WHERE id = ?", [
      JSON.stringify(args.preferences),
      Date.now(),
      profileId,
    ]);
    return { ok: true };
  },

  async agreeToTerms(env, args) {
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    if (args.role !== "worker" && args.role !== "user") throw bad("Pick Worker or User.");
    const actor = await actorForToken(env, sessionToken);
    if (!actor) return { ok: false, error: "Sign in again." };
    await runSql(
      env,
      "UPDATE profiles SET terms_version = ?, terms_role = ?, terms_agreed_at = ?, updated_at = ? WHERE id = ?",
      [CURRENT_TERMS_VERSION, args.role, Date.now(), Date.now(), actor.id],
    );
    return { ok: true, error: null };
  },

  /* In-app contact on a job: chat messages and voice call
     signaling. Both are checked the same way: the caller is
     proven by the session token, and only the job's two parties
     can read or write. Contact opens once a worker is accepted
     (the job has a provider) and stays open for the job's whole
     life, including after it is done. No phone numbers are
     involved anywhere: names only. */

  async listJobMessages(env, args) {
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const jobId = reqId(args.jobId, "jobId");
    const actor = await actorForToken(env, sessionToken);
    if (!actor) return { messages: [] };
    const job = await jobForId(env, jobId);
    if (!job || !job.provider_id) return { messages: [] };
    const poster = isPosterRow(job, actor);
    const worker = isWorkerRow(job, actor);
    if (!poster && !worker) return { messages: [] };
    const rows = await allRows(
      env,
      "SELECT * FROM messages WHERE job_id = ? ORDER BY id ASC LIMIT 500",
      [jobId],
    );
    const names = new Map();
    for (const pid of [job.customer_profile_id, job.provider_id]) {
      if (pid == null) continue;
      const p = await firstRow(env, "SELECT full_name FROM profiles WHERE id = ?", [pid]);
      if (p) names.set(pid, p.full_name);
    }
    return {
      messages: rows.map((m) => ({
        id: m.id,
        senderProfileId: m.sender_profile_id,
        senderName: names.get(m.sender_profile_id) ?? "",
        body: m.body,
        createdAt: new Date(m.created_at).toISOString(),
        mine: m.sender_profile_id === actor.id,
      })),
    };
  },

  async sendJobMessage(env, args) {
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const jobId = reqId(args.jobId, "jobId");
    const body = reqStr(args.body, "body", 1, 1000);
    const actor = await actorForToken(env, sessionToken);
    if (!actor) return { ok: false, error: "Sign in again." };
    const job = await jobForId(env, jobId);
    if (!job) return { ok: false, error: "That job is not there anymore." };
    if (!job.provider_id) return { ok: false, error: "Chat opens when a worker takes the job." };
    if (!isPosterRow(job, actor) && !isWorkerRow(job, actor)) {
      return { ok: false, error: "Only the two people on this job can use its chat." };
    }
    const res = await runSql(
      env,
      "INSERT INTO messages (job_id, sender_profile_id, body, created_at) VALUES (?, ?, ?, ?)",
      [jobId, actor.id, body.trim(), Date.now()],
    );
    const otherId = isPosterRow(job, actor) ? job.provider_id : job.customer_profile_id;
    await notifyJobEvent(env, otherId, job, "chat", `New message about the job: ${job.title}`);
    return { ok: true, error: null, id: res.meta.last_row_id };
  },

  async sendCallSignal(env, args) {
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const jobId = reqId(args.jobId, "jobId");
    const kind = reqStr(args.kind, "kind", 2, 20);
    const kinds = ["ring", "offer", "answer", "candidate", "accept", "decline", "end"];
    if (!kinds.includes(kind)) throw bad("Invalid kind.");
    const payload = optStr(args.payload, "payload", 30000, undefined);
    const actor = await actorForToken(env, sessionToken);
    if (!actor) return { ok: false, error: "Sign in again." };
    const job = await jobForId(env, jobId);
    if (!job) return { ok: false, error: "That job is not there anymore." };
    if (!job.provider_id) return { ok: false, error: "Calls open when a worker takes the job." };
    const poster = isPosterRow(job, actor);
    const worker = isWorkerRow(job, actor);
    if (!poster && !worker) return { ok: false, error: "Only the two people on this job can call on it." };
    const res = await runSql(
      env,
      "INSERT INTO call_signals (job_id, from_profile_id, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)",
      [jobId, actor.id, kind, payload ?? null, Date.now()],
    );
    if (kind === "ring") {
      /* The other side sees the incoming call in their app by
         polling, and also gets a notification record and a push,
         the same machinery as every other job event. */
      const otherId = poster ? job.provider_id : job.customer_profile_id;
      const callerFirst = String(actor.full_name || "Someone").split(" ")[0];
      await notifyJobEvent(env, otherId, job, "call", `${callerFirst} is calling you about the job: ${job.title}`);
    }
    return { ok: true, error: null, id: res.meta.last_row_id };
  },

  async listCallSignals(env, args) {
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const jobId = reqId(args.jobId, "jobId");
    let sinceId = 0;
    if (args.sinceId !== undefined && args.sinceId !== null) {
      if (typeof args.sinceId !== "number" || !Number.isInteger(args.sinceId) || args.sinceId < 0) {
        throw bad("Invalid sinceId.");
      }
      sinceId = args.sinceId;
    }
    const actor = await actorForToken(env, sessionToken);
    if (!actor) return { signals: [] };
    const job = await jobForId(env, jobId);
    if (!job || !job.provider_id) return { signals: [] };
    if (!isPosterRow(job, actor) && !isWorkerRow(job, actor)) return { signals: [] };
    const rows = await allRows(
      env,
      "SELECT * FROM call_signals WHERE job_id = ? AND id > ? ORDER BY id ASC LIMIT 200",
      [jobId, sinceId],
    );
    return {
      signals: rows.map((s) => ({
        id: s.id,
        fromProfileId: s.from_profile_id,
        kind: s.kind,
        payload: s.payload ?? null,
        createdAt: new Date(s.created_at).toISOString(),
      })),
    };
  },

  async unreadNotificationCount(env, args) {
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const actor = await actorForToken(env, sessionToken);
    if (!actor) return { unread: 0, vapidPublicKey: null };
    const rows = await allRows(
      env,
      "SELECT COUNT(*) AS n FROM notifications WHERE profile_id = ? AND read_at IS NULL",
      [actor.id],
    );
    return { unread: rows[0]?.n ?? 0, vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null };
  },

  async listNotifications(env, args) {
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const actor = await actorForToken(env, sessionToken);
    if (!actor) return { notifications: [], vapidPublicKey: null };
    const rows = await allRows(
      env,
      "SELECT * FROM notifications WHERE profile_id = ? ORDER BY id DESC LIMIT 200",
      [actor.id],
    );
    const notifications = rows.map((n) => ({
      id: n.id,
      jobId: n.job_id ?? null,
      kind: n.kind,
      text: n.text,
      createdAt: new Date(n.created_at).toISOString(),
      unread: n.read_at == null,
    }));
    /* Opening the list marks them all seen. The rows above keep
       the unread flag they had when the list was opened, so the
       red dots show on this visit and are gone on the next. */
    await runSql(env, "UPDATE notifications SET read_at = ? WHERE profile_id = ? AND read_at IS NULL", [Date.now(), actor.id]);
    return { notifications, vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null };
  },

  async savePushSubscription(env, args) {
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const endpoint = reqStr(args.endpoint, "endpoint", 10, 2000);
    if (!endpoint.startsWith("https://")) throw bad("Invalid endpoint.");
    const p256dh = reqStr(args.p256dh, "p256dh", 10, 500);
    const auth = reqStr(args.auth, "auth", 8, 200);
    const actor = await actorForToken(env, sessionToken);
    if (!actor) return { ok: false, error: "Sign in again." };
    await runSql(
      env,
      `INSERT INTO push_subscriptions (profile_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET profile_id = excluded.profile_id,
         p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at`,
      [actor.id, endpoint, p256dh, auth, Date.now()],
    );
    return { ok: true, error: null };
  },

  async deletePushSubscription(env, args) {
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const endpoint = reqStr(args.endpoint, "endpoint", 10, 2000);
    const actor = await actorForToken(env, sessionToken);
    if (!actor) return { ok: false, error: "Sign in again." };
    await runSql(env, "DELETE FROM push_subscriptions WHERE profile_id = ? AND endpoint = ?", [actor.id, endpoint]);
    return { ok: true, error: null };
  },

  async adminGetData(env, args) {
    // Separate admin view, only for the owner's own phone number. The
    // caller's identity comes from the session token; a caller-supplied
    // phone number is never trusted. Any other number gets a plain
    // refusal and no data at all.
    const sessionToken = reqStr(args.sessionToken, "sessionToken", 10, 300);
    const refusal = {
      ok: false,
      error: "This area is only for the Jackwork owner.",
      counts: { profiles: 0, jobsOpen: 0, jobsWorking: 0, problems: 0, jobsDone: 0 },
      jobs: [],
      profiles: [],
    };
    const actor = await actorForToken(env, sessionToken);
    if (!actor || !samePhone(actor.phone, ADMIN_PHONE)) return refusal;
    await autoCompleteDueJobs(env);
    const countRows = await allRows(
      env,
      `SELECT
         (SELECT COUNT(*) FROM profiles) AS profiles,
         (SELECT COUNT(*) FROM jobs WHERE status = 'open') AS jobs_open,
         (SELECT COUNT(*) FROM jobs WHERE status = 'in_progress') AS jobs_working,
         (SELECT COUNT(*) FROM jobs WHERE problem_reported = 1) AS problems,
         (SELECT COUNT(*) FROM jobs WHERE status = 'completed') AS jobs_done`,
    );
    const c = countRows[0] || {};
    const jobRows = await allRows(env, `SELECT * FROM jobs ORDER BY created_at DESC`);
    const profileRows = await allRows(env, `SELECT * FROM profiles ORDER BY id ASC`);
    const postedBy = new Map();
    const doneBy = new Map();
    for (const j of jobRows) {
      if (j.customer_profile_id != null) postedBy.set(j.customer_profile_id, (postedBy.get(j.customer_profile_id) || 0) + 1);
      if (j.provider_id != null && j.status === "completed") doneBy.set(j.provider_id, (doneBy.get(j.provider_id) || 0) + 1);
    }
    /* When a Problem is pressed on a job, the operator can read
       that job's chat to help settle it (stated in the Privacy
       Policy). Chats of jobs with no problem are not included. */
    const chatByJob = new Map();
    for (const j of jobRows) {
      if (!j.problem_reported) continue;
      const msgs = await allRows(env, "SELECT * FROM messages WHERE job_id = ? ORDER BY id ASC LIMIT 200", [j.id]);
      chatByJob.set(j.id, msgs.map((m) => ({
        from: m.sender_profile_id === j.customer_profile_id ? (j.customer_name || "Poster")
          : m.sender_profile_id === j.provider_id ? (j.provider_name || "Worker") : "Unknown",
        body: m.body,
        createdAt: new Date(m.created_at).toISOString(),
      })));
    }
    const townPart = (loc) => (loc || "").split(",")[0].trim();
    return {
      ok: true,
      error: null,
      counts: {
        profiles: c.profiles || 0,
        jobsOpen: c.jobs_open || 0,
        jobsWorking: c.jobs_working || 0,
        problems: c.problems || 0,
        jobsDone: c.jobs_done || 0,
      },
      jobs: jobRows.slice(0, 500).map((j) => ({
        id: j.id,
        title: j.title,
        posterName: j.customer_name || "",
        workerName: j.provider_name || null,
        place: j.landmark || townPart(j.location),
        amount: j.budget_amount ?? null,
        currency: j.budget_currency || "LRD",
        status: j.status,
        paymentState: j.payment_state || "waiting",
        problemReported: !!j.problem_reported,
        problemBy: j.problem_by || null,
        chat: chatByJob.get(j.id) ?? [],
        createdAt: new Date(j.created_at).toISOString(),
      })),
      profiles: profileRows.map((p) => ({
        id: p.id,
        name: p.full_name,
        phone: p.phone,
        place: [p.community || p.city || "", p.county || ""].filter(Boolean).join(", "),
        jobsPosted: postedBy.get(p.id) || 0,
        jobsDone: doneBy.get(p.id) || 0,
      })),
    };
  },

  async listAllProfiles(env, args) {
    let limit = 200;
    if (args.limit !== undefined && args.limit !== null) {
      if (typeof args.limit !== "number" || !Number.isInteger(args.limit) || args.limit <= 0 || args.limit > 500) {
        throw bad("Invalid limit.");
      }
      limit = args.limit;
    }
    const rows = await allRows(env, "SELECT * FROM profiles ORDER BY id DESC LIMIT ?", [limit]);
    return {
      profiles: rows.map((r) => ({
        id: r.id,
        profileImageUrl: r.profile_blob_key ? blobUrl(r.profile_blob_key) : null,
        county: r.county ?? null,
        district: r.district ?? null,
        city: r.city ?? null,
        community: r.community ?? (r.address ? r.address : null),
        address: r.address,
      })),
    };
  },
};

/* The push service worker: shows the notification the Worker
   sent, and opens the app when it is tapped. */
const SW_JS = `self.addEventListener("push", function (event) {
  var text = "You have a new notification.";
  var jobId = null;
  try {
    var d = event.data ? event.data.json() : null;
    if (d && d.text) { text = d.text; jobId = d.jobId || null; }
  } catch (e) {
    try { text = event.data.text(); } catch (e2) {}
  }
  event.waitUntil(self.registration.showNotification("Jackwork", { body: text, icon: "/favicon.ico", data: { jobId: jobId } }));
});
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
`;

/* ---------------- HTTP ---------------- */

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function assetResponse(buf, contentType, cacheControl) {
  return new Response(buf, {
    headers: { "content-type": contentType, "cache-control": cacheControl },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/actions") {
      if (request.method !== "POST") return jsonResponse({ error: "POST only." }, 405);
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body." }, 400);
      }
      const action = body?.action;
      const args = body?.args ?? {};
      const fn = typeof action === "string" ? Actions[action] : undefined;
      if (!fn) return jsonResponse({ error: `Unknown action: ${String(action)}` }, 404);
      try {
        const data = await fn(env, args);
        return jsonResponse({ data });
      } catch (e) {
        return jsonResponse({ error: e && e.message ? e.message : "Action failed." }, e?.isInputError ? 400 : 500);
      }
    }

    if (path.startsWith("/blobs/")) {
      const key = path.slice("/blobs/".length).split("/").map(decodeURIComponent).join("/");
      const row = await firstRow(env, "SELECT mime, data FROM blobs WHERE key = ?", [key]);
      if (!row) return new Response("Not found", { status: 404 });
      // D1 hands BLOB values back as an array of byte numbers; passing
      // that straight to Response would stringify it, so rebuild bytes.
      const bytes = Array.isArray(row.data)
        ? Uint8Array.from(row.data)
        : row.data instanceof ArrayBuffer
          ? new Uint8Array(row.data)
          : new TextEncoder().encode(String(row.data));
      return new Response(bytes, {
        headers: { "content-type": row.mime, "cache-control": "private, max-age=3600" },
      });
    }

    if (request.method === "GET" || request.method === "HEAD") {
      if (path === "/sw.js") {
        return assetResponse(SW_JS, "text/javascript; charset=utf-8", "no-cache");
      }
      if (path === "/admin") {
        // The separate admin page. It is not linked from the user app,
        // and it shows no data until the owner number signs in and the
        // token-checked adminGetData action answers.
        return assetResponse(adminHtml, "text/html; charset=utf-8", "no-store");
      }
      if (path === "/" || path === "/index.html") {
        return assetResponse(indexHtml, "text/html; charset=utf-8", "no-cache");
      }
      if (path.startsWith("/assets/")) {
        if (path.endsWith(".js")) return assetResponse(mainJs, "text/javascript; charset=utf-8", "public, max-age=31536000, immutable");
        if (path.endsWith(".css")) return assetResponse(styleCss, "text/css; charset=utf-8", "public, max-age=31536000, immutable");
        if (path.includes("icon-192")) return assetResponse(icon192, "image/png", "public, max-age=31536000, immutable");
        if (path.includes("icon-512")) return assetResponse(icon512, "image/png", "public, max-age=31536000, immutable");
      }
      if (path === "/favicon.ico") {
        return assetResponse(icon192, "image/png", "public, max-age=86400");
      }
      // Single page app: any other path returns the app shell.
      return assetResponse(indexHtml, "text/html; charset=utf-8", "no-cache");
    }

    return new Response("Not found", { status: 404 });
  },
};

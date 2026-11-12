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

function toJob(row, stripPrivate = false) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    location: row.location,
    landmark: row.landmark ?? null,
    budgetAmount: row.budget_amount ?? null,
    budgetCurrency: row.budget_currency,
    budgetType: row.budget_type,
    urgency: row.urgency,
    scheduledDate: row.scheduled_date ?? null,
    scheduledTime: row.scheduled_time ?? null,
    // Private to the poster and the worker on the job: the call numbers,
    // the house directions, and the poster's own GPS pin never go to
    // other board viewers. placeLat/placeLng stay: they are the surveyed
    // coordinates of a named town from the public settlement dataset.
    houseDirections: stripPrivate ? null : (row.house_directions ?? null),
    customerName: row.customer_name,
    customerPhone: stripPrivate ? "" : row.customer_phone,
    contactPhone: stripPrivate ? null : (row.contact_phone ?? null),
    task: row.task ?? null,
    customerProfileId: row.customer_profile_id ?? null,
    gpsLat: stripPrivate ? null : (row.gps_lat ?? null),
    gpsLng: stripPrivate ? null : (row.gps_lng ?? null),
    placeLat: row.place_lat ?? null,
    placeLng: row.place_lng ?? null,
    status: row.status,
    providerName: row.provider_name ?? null,
    providerPhone: stripPrivate ? null : (row.provider_phone ?? null),
    providerId: row.provider_id ?? null,
    rating: row.rating ?? null,
    review: row.review ?? null,
    payMethod: "Mobile Money",
    ratingByProvider: row.rating_by_provider ?? null,
    reviewByProvider: row.review_by_provider ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

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
    const isParty = (j) =>
      viewerId != null &&
      (j.customer_profile_id === viewerId ||
        j.provider_id === viewerId ||
        (j.customer_phone && samePhone(j.customer_phone, viewerPhone)) ||
        (j.provider_phone && samePhone(j.provider_phone, viewerPhone)));
    return { jobs: rows.map((j) => toJob(j, !isParty(j))) };
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
         place_lat, place_lng, pay_method, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
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
        contactPhone?.trim() ? contactPhone.trim() : customerPhone.trim(),
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
    const job = await firstRow(env, "SELECT * FROM jobs WHERE id = ?", [jobId]);
    if (!job) return { ok: false, error: "That job no longer exists." };
    if (job.status !== "open") return { ok: false, error: "Someone else already took this job." };
    const prof = await firstRow(env, "SELECT * FROM profiles WHERE id = ?", [providerProfileId]);
    if (!prof) return { ok: false, error: "Create your profile first, then you can accept jobs." };
    if (job.customer_profile_id === prof.id) {
      return { ok: false, error: "You cannot accept your own job." };
    }
    await runSql(
      env,
      "UPDATE jobs SET status = 'accepted', provider_name = ?, provider_phone = ?, provider_id = ?, updated_at = ? WHERE id = ?",
      [prof.full_name, prof.phone, prof.id, Date.now(), jobId],
    );
    return { ok: true, error: null };
  },

  async updateJobStatus(env, args) {
    const jobId = reqId(args.jobId, "jobId");
    if (!["open", "in_progress", "completed", "cancelled"].includes(args.status)) {
      throw bad("Invalid status.");
    }
    if (args.status === "open") {
      await runSql(
        env,
        "UPDATE jobs SET status = 'open', provider_name = NULL, provider_phone = NULL, provider_id = NULL, updated_at = ? WHERE id = ?",
        [Date.now(), jobId],
      );
    } else {
      await runSql(env, "UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?", [args.status, Date.now(), jobId]);
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
    await runSql(env, "UPDATE profiles SET work_preferences = ?, updated_at = ? WHERE id = ?", [
      JSON.stringify(args.preferences),
      Date.now(),
      profileId,
    ]);
    return { ok: true };
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

-- Jackwork live schema for Cloudflare D1.
-- Mirrors the final state of the Space schema (server/src/schema.ts after
-- migrations 0001 to 0012), with timestamps as epoch milliseconds.
-- Live data starts clean: no rows are seeded here.

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  date_of_birth TEXT,
  id_type TEXT,
  id_number TEXT,
  id_blob_key TEXT,
  id_mime TEXT,
  session_token TEXT,
  profile_blob_key TEXT,
  profile_mime TEXT,
  county TEXT,
  district TEXT,
  city TEXT,
  community TEXT,
  house_directions TEXT,
  mobile_money_number TEXT,
  work_preferences TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  offers_services INTEGER NOT NULL DEFAULT 0,
  gps_lat REAL,
  gps_lng REAL,
  place_lat REAL,
  place_lng REAL,
  trade_category TEXT,
  bio TEXT NOT NULL DEFAULT '',
  years_experience INTEGER,
  available INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS signin_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  landmark TEXT,
  budget_amount INTEGER,
  budget_currency TEXT NOT NULL DEFAULT 'USD',
  budget_type TEXT NOT NULL DEFAULT 'Fixed price',
  urgency TEXT NOT NULL DEFAULT 'Right now',
  scheduled_date TEXT,
  scheduled_time TEXT,
  house_directions TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  contact_phone TEXT,
  task TEXT,
  customer_profile_id INTEGER,
  gps_lat REAL,
  gps_lng REAL,
  place_lat REAL,
  place_lng REAL,
  status TEXT NOT NULL DEFAULT 'open',
  provider_name TEXT,
  provider_phone TEXT,
  provider_id INTEGER,
  rating INTEGER,
  review TEXT,
  pay_method TEXT NOT NULL DEFAULT 'Cash',
  rating_by_provider INTEGER,
  review_by_provider TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Uploaded photos (profile pictures and ID documents), keyed the same way
-- the Space blob store keyed them, for example id-documents/profile-3.
CREATE TABLE IF NOT EXISTS blobs (
  key TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_session_token ON profiles (session_token);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_signin_codes_phone ON signin_codes (phone);

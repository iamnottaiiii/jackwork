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
  work_prefs_answered INTEGER NOT NULL DEFAULT 0,
  terms_version INTEGER,
  terms_agreed_at INTEGER,
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
  worker_confirmed_at INTEGER,
  proposed_budget_amount INTEGER,
  price_proposed_at INTEGER,
  payment_state TEXT NOT NULL DEFAULT 'waiting',
  payment_marked_at INTEGER,
  before_proof_blob_key TEXT,
  before_proof_mime TEXT,
  after_proof_blob_key TEXT,
  after_proof_mime TEXT,
  worker_done_at INTEGER,
  poster_confirmed_at INTEGER,
  completed_at INTEGER,
  auto_completed INTEGER NOT NULL DEFAULT 0,
  problem_reported INTEGER NOT NULL DEFAULT 0,
  problem_by TEXT,
  problem_at INTEGER,
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

-- Lifecycle columns for databases created before the job lifecycle
-- existed. The deploy runner skips any column that is already there.
ALTER TABLE jobs ADD COLUMN worker_confirmed_at INTEGER;
ALTER TABLE jobs ADD COLUMN proposed_budget_amount INTEGER;
ALTER TABLE jobs ADD COLUMN price_proposed_at INTEGER;
ALTER TABLE jobs ADD COLUMN payment_state TEXT NOT NULL DEFAULT 'waiting';
ALTER TABLE jobs ADD COLUMN payment_marked_at INTEGER;
ALTER TABLE jobs ADD COLUMN before_proof_blob_key TEXT;
ALTER TABLE jobs ADD COLUMN before_proof_mime TEXT;
ALTER TABLE jobs ADD COLUMN after_proof_blob_key TEXT;
ALTER TABLE jobs ADD COLUMN after_proof_mime TEXT;
ALTER TABLE jobs ADD COLUMN worker_done_at INTEGER;
ALTER TABLE jobs ADD COLUMN poster_confirmed_at INTEGER;
ALTER TABLE jobs ADD COLUMN completed_at INTEGER;
ALTER TABLE jobs ADD COLUMN auto_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN problem_reported INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN problem_by TEXT;
ALTER TABLE jobs ADD COLUMN problem_at INTEGER;

-- Find work first-visit ask flag, for databases created before it
-- existed. The deploy runner skips it when the column is already there.
ALTER TABLE profiles ADD COLUMN work_prefs_answered INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_session_token ON profiles (session_token);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_signin_codes_phone ON signin_codes (phone);

-- Notifications: one row per event, addressed to one person. The
-- in-app list reads these. read_at is set when the person opens
-- the list. sms_status records what happened with the text
-- message for the same event: while no SMS line is connected it
-- stays 'waiting_for_line' and no text is sent.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  job_id INTEGER,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  sms_status TEXT NOT NULL DEFAULT 'waiting_for_line',
  created_at INTEGER NOT NULL,
  read_at INTEGER
);

-- Web Push subscriptions, one per browser or installed app the
-- person turned phone notifications on from.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications (profile_id, id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile ON push_subscriptions (profile_id);

-- Terms agreement, for databases created before the gate existed.
-- The deploy runner skips any column that is already there.
ALTER TABLE profiles ADD COLUMN terms_version INTEGER;
ALTER TABLE profiles ADD COLUMN terms_agreed_at INTEGER;

-- In-app chat on a job: one row per message, readable and writable
-- only by the job's two parties (checked server side by token).
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  sender_profile_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- In-app voice call signaling (WebRTC): short-lived rows the two
-- clients poll while a call is being set up (ring, offer, answer,
-- candidate) or torn down (decline, end). No call audio ever
-- touches the server. The call itself is browser to browser.
CREATE TABLE IF NOT EXISTS call_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  from_profile_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_job ON messages (job_id, id);
CREATE INDEX IF NOT EXISTS idx_call_signals_job ON call_signals (job_id, id);

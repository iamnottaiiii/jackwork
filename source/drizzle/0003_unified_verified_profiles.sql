DROP TABLE providers;
--> statement-breakpoint
CREATE TABLE profiles (
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
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  offers_services INTEGER NOT NULL DEFAULT 0,
  trade_category TEXT,
  bio TEXT NOT NULL DEFAULT '',
  years_experience INTEGER,
  available INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN customer_profile_id INTEGER;

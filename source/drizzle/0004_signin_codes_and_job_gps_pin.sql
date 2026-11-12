CREATE TABLE signin_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN gps_lat REAL;
--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN gps_lng REAL;

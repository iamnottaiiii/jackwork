DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  landmark TEXT,
  budget_amount INTEGER,
  budget_currency TEXT NOT NULL DEFAULT 'USD',
  budget_type TEXT NOT NULL DEFAULT 'Fixed price',
  urgency TEXT NOT NULL DEFAULT 'Today',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  provider_name TEXT,
  provider_phone TEXT,
  provider_id INTEGER,
  rating INTEGER,
  review TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  years_experience INTEGER,
  available INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

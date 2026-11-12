CREATE TABLE IF NOT EXISTS messages (
  id integer PRIMARY KEY AUTOINCREMENT,
  job_id integer NOT NULL,
  sender_profile_id integer NOT NULL,
  body text NOT NULL,
  created_at integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS call_signals (
  id integer PRIMARY KEY AUTOINCREMENT,
  job_id integer NOT NULL,
  from_profile_id integer NOT NULL,
  kind text NOT NULL,
  payload text,
  created_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messages_job ON messages (job_id, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_call_signals_job ON call_signals (job_id, id);

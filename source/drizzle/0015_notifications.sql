CREATE TABLE IF NOT EXISTS notifications (
  id integer PRIMARY KEY AUTOINCREMENT,
  profile_id integer NOT NULL,
  job_id integer,
  kind text NOT NULL,
  text text NOT NULL,
  sms_status text NOT NULL DEFAULT 'waiting_for_line',
  created_at integer NOT NULL,
  read_at integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id integer PRIMARY KEY AUTOINCREMENT,
  profile_id integer NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications (profile_id, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile ON push_subscriptions (profile_id);

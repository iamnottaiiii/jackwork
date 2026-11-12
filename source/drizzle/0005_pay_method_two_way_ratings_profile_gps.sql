ALTER TABLE profiles ADD COLUMN gps_lat REAL;
--> statement-breakpoint
ALTER TABLE profiles ADD COLUMN gps_lng REAL;
--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN pay_method TEXT NOT NULL DEFAULT 'Cash';
--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN rating_by_provider INTEGER;
--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN review_by_provider TEXT;

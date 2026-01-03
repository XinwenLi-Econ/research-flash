ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'Asia/Shanghai';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_digest_sent_at" timestamp with time zone;
-- Idempotent: production may already have some of these from `drizzle-kit push`.
ALTER TABLE "agent_settings" ADD COLUMN IF NOT EXISTS "notification_email" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "ai_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_tenant_start_scheduled_idx" ON "appointments" USING btree ("tenant_id","start_at") WHERE "appointments"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_tenant_start_idx" ON "appointments" USING btree ("tenant_id","start_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
DELETE FROM "google_accounts" a USING "google_accounts" b WHERE a."tenant_id" = b."tenant_id" AND a."updated_at" < b."updated_at";--> statement-breakpoint
DELETE FROM "wa_accounts" a USING "wa_accounts" b WHERE a."tenant_id" = b."tenant_id" AND a."created_at" < b."created_at";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_tenant_id_unique" UNIQUE("tenant_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wa_accounts" ADD CONSTRAINT "wa_accounts_tenant_id_unique" UNIQUE("tenant_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;--> statement-breakpoint
-- Fails loudly if two tenants share a phone_number_id; resolve those rows by hand first.
DO $$ BEGIN
  ALTER TABLE "wa_accounts" ADD CONSTRAINT "wa_accounts_phone_number_id_unique" UNIQUE("phone_number_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

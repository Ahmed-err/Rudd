ALTER TABLE "agent_settings" ADD COLUMN "reminders_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_settings" ADD COLUMN "reminder_hours_before" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_settings" ADD COLUMN "reminder_template_name" text;--> statement-breakpoint
ALTER TABLE "agent_settings" ADD COLUMN "reminder_template_language" varchar(15) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp;
CREATE TABLE IF NOT EXISTS "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"provider" varchar(24) NOT NULL,
	"smtp_host" varchar(253),
	"smtp_port" integer,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"imap_host" varchar(253),
	"imap_port" integer,
	"imap_secure" boolean DEFAULT true NOT NULL,
	"imap_mailbox" varchar(255) DEFAULT 'INBOX',
	"encrypted_credentials" text,
	"credentials_configured" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"health_status" varchar(20) DEFAULT 'unknown' NOT NULL,
	"last_error" text,
	"sync_cursor" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"object_key" varchar(1024) NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"content_id" varchar(512),
	"disposition" varchar(20) DEFAULT 'attachment' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"account_id" uuid,
	"provider" varchar(32) NOT NULL,
	"provider_event_id" varchar(512) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"normalized_message_key" varchar(512) NOT NULL,
	"provider_message_id" varchar(512),
	"external_id" varchar(512),
	"direction" varchar(12) NOT NULL,
	"folder" varchar(32) NOT NULL,
	"from_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"to_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bcc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" varchar(500) DEFAULT '' NOT NULL,
	"text_body" text,
	"html_body" text,
	"raw_mime_object_key" varchar(1024),
	"is_read" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"status" varchar(24) DEFAULT 'received' NOT NULL,
	"error_code" varchar(100),
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"leased_until" timestamp with time zone,
	"external_id" varchar(512),
	"last_error_code" varchar(100),
	"last_error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"subject" varchar(500) DEFAULT '' NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_company_message_fk" FOREIGN KEY ("company_id","message_id") REFERENCES "public"."email_messages"("company_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_events" ADD CONSTRAINT "email_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_events" ADD CONSTRAINT "email_events_company_account_fk" FOREIGN KEY ("company_id","account_id") REFERENCES "public"."email_accounts"("company_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_company_account_fk" FOREIGN KEY ("company_id","account_id") REFERENCES "public"."email_accounts"("company_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_company_thread_fk" FOREIGN KEY ("company_id","thread_id") REFERENCES "public"."email_threads"("company_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_company_account_fk" FOREIGN KEY ("company_id","account_id") REFERENCES "public"."email_accounts"("company_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_company_account_fk" FOREIGN KEY ("company_id","account_id") REFERENCES "public"."email_accounts"("company_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_accounts_company_id_id_unique" ON "email_accounts" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_accounts_company_email_unique" ON "email_accounts" USING btree ("company_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_attachments_company_id_id_unique" ON "email_attachments" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_attachments_message_object_unique" ON "email_attachments" USING btree ("message_id","object_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_events_provider_event_unique" ON "email_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_company_received_idx" ON "email_events" USING btree ("company_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_company_id_id_unique" ON "email_messages" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_account_key_unique" ON "email_messages" USING btree ("account_id","normalized_message_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_thread_created_idx" ON "email_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_company_id_id_unique" ON "email_outbox" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_company_idempotency_unique" ON "email_outbox" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_status_attempt_idx" ON "email_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_threads_company_id_id_unique" ON "email_threads" USING btree ("company_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_threads_account_last_idx" ON "email_threads" USING btree ("account_id","last_message_at");

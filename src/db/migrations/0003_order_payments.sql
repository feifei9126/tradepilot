ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" varchar(24) DEFAULT 'unpaid' NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "amount_paid_minor" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "provider" varchar(16) NOT NULL,
  "display_name" varchar(120) NOT NULL,
  "public_account_id" varchar(80) NOT NULL,
  "encrypted_credentials" text,
  "credentials_configured" boolean DEFAULT false NOT NULL,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "health_status" varchar(16) DEFAULT 'unknown' NOT NULL,
  "last_error" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "payment_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" varchar(3) NOT NULL,
  "description" varchar(500) NOT NULL,
  "public_token_hash" varchar(128) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "payment_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "payment_account_id" uuid NOT NULL,
  "provider" varchar(16) NOT NULL,
  "idempotency_key" varchar(255) NOT NULL,
  "provider_transaction_id" varchar(512),
  "payment_url" text,
  "code_url" text,
  "amount_minor" integer NOT NULL,
  "currency" varchar(3) NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "failure_code" varchar(100),
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "payment_provider_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "provider" varchar(16) NOT NULL,
  "provider_event_id" varchar(512) NOT NULL,
  "payload_hash" varchar(128) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "received_at" timestamptz DEFAULT now() NOT NULL,
  "processed_at" timestamptz
);
CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "attempt_id" uuid NOT NULL,
  "amount_minor" integer NOT NULL,
  "reason" varchar(500) NOT NULL,
  "provider_refund_id" varchar(512),
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "idempotency_key" varchar(255) NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_accounts_public_id_unique" ON "payment_accounts" ("public_account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_accounts_company_public_id_unique" ON "payment_accounts" ("company_id", "public_account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_accounts_company_id_unique" ON "payment_accounts" ("company_id", "id");
CREATE INDEX IF NOT EXISTS "payment_accounts_company_provider_idx" ON "payment_accounts" ("company_id", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_token_hash_unique" ON "payment_requests" ("public_token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_company_id_unique" ON "payment_requests" ("company_id", "id");
CREATE INDEX IF NOT EXISTS "payment_requests_company_order_idx" ON "payment_requests" ("company_id", "order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_company_idempotency_unique" ON "payment_attempts" ("company_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_company_id_unique" ON "payment_attempts" ("company_id", "id");
CREATE INDEX IF NOT EXISTS "payment_attempts_request_status_idx" ON "payment_attempts" ("request_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_provider_event_unique" ON "payment_provider_events" ("provider", "provider_event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_company_id_unique" ON "payment_provider_events" ("company_id", "id");
CREATE INDEX IF NOT EXISTS "payment_events_company_received_idx" ON "payment_provider_events" ("company_id", "received_at");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_company_idempotency_unique" ON "payment_refunds" ("company_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_company_id_unique" ON "payment_refunds" ("company_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_provider_id_unique" ON "payment_refunds" ("provider_refund_id");
CREATE INDEX IF NOT EXISTS "payment_refunds_request_idx" ON "payment_refunds" ("company_id", "request_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_order_fk" FOREIGN KEY ("company_id", "order_id") REFERENCES "orders"("company_id", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_request_fk" FOREIGN KEY ("company_id", "request_id") REFERENCES "payment_requests"("company_id", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_account_fk" FOREIGN KEY ("company_id", "payment_account_id") REFERENCES "payment_accounts"("company_id", "id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_events_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_request_fk" FOREIGN KEY ("company_id", "request_id") REFERENCES "payment_requests"("company_id", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_attempt_fk" FOREIGN KEY ("company_id", "attempt_id") REFERENCES "payment_attempts"("company_id", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

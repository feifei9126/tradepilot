-- Billing state, real mail credentials/sync, marketing compliance and durable media metadata.
-- Provider payloads and secrets are deliberately not stored in plaintext.

CREATE TABLE IF NOT EXISTS billing_plans (
  id varchar(40) PRIMARY KEY,
  name varchar(100) NOT NULL,
  description text NOT NULL DEFAULT '',
  currency varchar(3) NOT NULL DEFAULT 'USD',
  monthly_price_cents integer NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  annual_price_cents integer NOT NULL DEFAULT 0 CHECK (annual_price_cents >= 0),
  monthly_request_limit integer NOT NULL DEFAULT 100 CHECK (monthly_request_limit BETWEEN 1 AND 1000000),
  monthly_token_limit bigint NOT NULL DEFAULT 100000 CHECK (monthly_token_limit BETWEEN 1000 AND 1000000000),
  max_members integer NOT NULL DEFAULT 3 CHECK (max_members BETWEEN 1 AND 100000),
  features jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(features) = 'object'),
  provider_monthly_price_id varchar(255),
  provider_annual_price_id varchar(255),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO billing_plans (id,name,description,currency,monthly_price_cents,annual_price_cents,monthly_request_limit,monthly_token_limit,max_members,features)
VALUES
  ('free','免费试用','适合本地验证和小规模试用','USD',0,0,100,100000,3,'{"email":false,"video":false,"objectStorage":false}'::jsonb),
  ('team','团队版','适合小型外贸团队的正式协作','USD',4900,49000,2000,2000000,10,'{"email":true,"video":true,"objectStorage":true}'::jsonb),
  ('business','业务版','适合多团队和更高用量','USD',14900,149000,10000,10000000,50,'{"email":true,"video":true,"objectStorage":true,"prioritySupport":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS billing_accounts (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  provider varchar(30) NOT NULL DEFAULT 'none' CHECK (provider IN ('none','stripe','manual')),
  provider_customer_id varchar(255),
  billing_email varchar(320),
  status varchar(30) NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','active','past_due','paused','closed')),
  default_payment_method_last4 varchar(4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id varchar(40) NOT NULL REFERENCES billing_plans(id),
  provider varchar(30) NOT NULL DEFAULT 'none' CHECK (provider IN ('none','stripe','manual')),
  provider_subscription_id varchar(255),
  status varchar(30) NOT NULL CHECK (status IN ('trialing','active','past_due','paused','canceled','incomplete','incomplete_expired')),
  billing_interval varchar(10) NOT NULL CHECK (billing_interval IN ('month','year')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_subscription_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_live_per_company
  ON subscriptions(company_id) WHERE status IN ('trialing','active','past_due','paused','incomplete');
CREATE INDEX IF NOT EXISTS subscriptions_company_time ON subscriptions(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_events (
  provider varchar(30) NOT NULL,
  event_id varchar(255) NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  event_type varchar(100) NOT NULL,
  payload_sha256 char(64) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('received','processed','ignored','failed')),
  failure_code varchar(100),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  PRIMARY KEY (provider, event_id)
);
CREATE INDEX IF NOT EXISTS payment_events_company_time ON payment_events(company_id, received_at DESC);

CREATE TABLE IF NOT EXISTS usage_invoice_items (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metric varchar(50) NOT NULL,
  quantity bigint NOT NULL CHECK (quantity >= 0),
  unit_amount_cents integer NOT NULL DEFAULT 0 CHECK (unit_amount_cents >= 0),
  currency varchar(3) NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_invoice_items_company_period ON usage_invoice_items(company_id, period_start DESC);

CREATE TABLE IF NOT EXISTS email_account_secrets (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  smtp_username varchar(320),
  smtp_password_ciphertext text,
  imap_username varchar(320),
  imap_password_ciphertext text,
  smtp_last_tested_at timestamptz,
  imap_last_tested_at timestamptz,
  smtp_last_error varchar(255),
  imap_last_error varchar(255),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, account_id)
);

CREATE TABLE IF NOT EXISTS email_sync_state (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  folder varchar(100) NOT NULL,
  uid_validity bigint,
  last_uid bigint NOT NULL DEFAULT 0 CHECK (last_uid >= 0),
  last_synced_at timestamptz,
  sync_error varchar(255),
  PRIMARY KEY (company_id, account_id, folder)
);

CREATE TABLE IF NOT EXISTS email_suppressions (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  reason varchar(80) NOT NULL DEFAULT 'unsubscribe',
  source varchar(80) NOT NULL DEFAULT 'user',
  unsubscribed_at timestamptz NOT NULL DEFAULT now(),
  resubscribed_at timestamptz,
  PRIMARY KEY (company_id, email)
);
CREATE INDEX IF NOT EXISTS email_suppressions_active ON email_suppressions(company_id, email) WHERE resubscribed_at IS NULL;

CREATE TABLE IF NOT EXISTS email_consent_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  event varchar(30) NOT NULL CHECK (event IN ('subscribed','unsubscribed','resubscribed','complained','bounced')),
  source varchar(80) NOT NULL,
  policy_version varchar(40),
  ip_hash char(64),
  user_agent_hash char(64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_consent_events_lookup ON email_consent_events(company_id, email, created_at DESC);

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  object_key varchar(500) NOT NULL,
  kind varchar(50) NOT NULL,
  filename varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256 char(64) NOT NULL,
  storage_provider varchar(20) NOT NULL CHECK (storage_provider IN ('local','s3')),
  status varchar(20) NOT NULL DEFAULT 'ready' CHECK (status IN ('pending','ready','failed','deleted')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_company_key ON media_assets(company_id, object_key);
CREATE INDEX IF NOT EXISTS media_assets_company_time ON media_assets(company_id, created_at DESC);

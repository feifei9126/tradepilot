-- Forward-only expansion. Roll back application code, not credential/usage data.
CREATE TABLE auth_login_buckets (
  key_hash char(64) PRIMARY KEY,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_login_buckets_cleanup ON auth_login_buckets(updated_at);

CREATE TABLE tenant_discovery_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  api_key_ciphertext text,
  enabled boolean NOT NULL DEFAULT false,
  daily_request_limit integer NOT NULL DEFAULT 20 CHECK(daily_request_limit BETWEEN 1 AND 1000),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE discovery_usage_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX discovery_usage_company_time ON discovery_usage_events(company_id,created_at);

CREATE TABLE email_consent_challenges (
  token_hash char(64) PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_consent_challenges_recipient ON email_consent_challenges(company_id,email);

-- Old media is not considered verified solely because its stored MIME is safe.
ALTER TABLE media_assets ADD COLUMN verified_mime_type varchar(120);
ALTER TABLE subscriptions ADD COLUMN provider_event_created bigint;
ALTER TABLE subscriptions ADD COLUMN provider_event_id varchar(255);
ALTER TABLE subscriptions ADD COLUMN reconciled_at timestamptz;
ALTER TABLE email_marketing_consents ADD COLUMN confirmed_at timestamptz;

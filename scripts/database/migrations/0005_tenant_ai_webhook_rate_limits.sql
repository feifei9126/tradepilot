-- Tenant-specific AI credentials/usage, replay-safe inbound webhook ledger,
-- and a database-backed rate limiter shared by every application replica.
CREATE TABLE IF NOT EXISTS tenant_ai_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  provider varchar(40) NOT NULL CHECK (provider IN ('openai','kimi','doubao','gemini','zhipu','deepseek','tongyi','openrouter','siliconflow')),
  model varchar(200) NOT NULL,
  api_key_ciphertext text,
  enabled boolean NOT NULL DEFAULT true,
  monthly_request_limit integer NOT NULL DEFAULT 1000 CHECK (monthly_request_limit BETWEEN 1 AND 10000),
  monthly_token_limit bigint NOT NULL DEFAULT 500000 CHECK (monthly_token_limit BETWEEN 1000 AND 10000000),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  task varchar(80) NOT NULL,
  provider varchar(40) NOT NULL,
  model varchar(200) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('pending','success','failed','abandoned')),
  reserved_tokens integer NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  tokens_used integer NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  failure_code varchar(60),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (status <> 'pending' OR reserved_tokens > 0)
);
CREATE INDEX IF NOT EXISTS ai_usage_company_time ON ai_usage_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_pending_time ON ai_usage_events(company_id, status, created_at) WHERE status='pending';

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  scope varchar(100) NOT NULL,
  key_hash char(64) NOT NULL,
  window_start timestamptz NOT NULL,
  hit_count integer NOT NULL CHECK (hit_count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, key_hash, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limit_expiry ON rate_limit_counters(expires_at);

CREATE TABLE IF NOT EXISTS tenant_webhook_credentials (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  secret_ciphertext text NOT NULL,
  previous_secret_ciphertext text,
  previous_valid_until timestamptz,
  rotated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rotated_at timestamptz NOT NULL DEFAULT now()
);

-- Deliberately stores only event metadata and a payload digest, not untrusted
-- webhook payloads which may contain personal data or secrets.
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id varchar(200) NOT NULL,
  event_type varchar(100) NOT NULL,
  payload_sha256 char(64) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, event_id)
);
CREATE INDEX IF NOT EXISTS webhook_events_company_time ON webhook_events(company_id, received_at DESC);

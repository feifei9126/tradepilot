-- Official messaging connectors; credentials are encrypted with tenant AAD.
CREATE TABLE messaging_accounts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('wechat','whatsapp')),
  name varchar(100) NOT NULL,
  config jsonb NOT NULL CHECK (jsonb_typeof(config)='object'),
  secrets_ciphertext text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  access_token_ciphertext text,
  access_token_expires_at timestamptz,
  last_verified_at timestamptz,
  last_received_at timestamptz,
  last_tested_at timestamptz,
  last_error varchar(250),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,id)
);
CREATE UNIQUE INDEX messaging_wechat_app ON messaging_accounts((config->>'appId')) WHERE channel='wechat';
CREATE UNIQUE INDEX messaging_whatsapp_number ON messaging_accounts((config->>'phoneNumberId')) WHERE channel='whatsapp';
CREATE INDEX messaging_accounts_company ON messaging_accounts(company_id);
CREATE TABLE messaging_events (
  company_id uuid NOT NULL,
  account_id uuid NOT NULL,
  event_id varchar(240) NOT NULL,
  payload_sha256 char(64) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,event_id),
  FOREIGN KEY(company_id,account_id) REFERENCES messaging_accounts(company_id,id) ON DELETE CASCADE
);
CREATE TABLE messaging_outbound (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  account_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  content_sha256 char(64) NOT NULL,
  peer_id varchar(200) NOT NULL,
  message_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('sending','sent','delivered','read','failed','unknown')),
  provider_message_id varchar(240),
  error_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,idempotency_key),
  FOREIGN KEY(company_id,account_id) REFERENCES messaging_accounts(company_id,id) ON DELETE CASCADE
);
CREATE INDEX messaging_outbound_provider ON messaging_outbound(account_id,provider_message_id);
CREATE INDEX messaging_inbox_peer ON crm_records(company_id,(data->>'channelAccountId'),(data->>'peerId')) WHERE kind='messages';

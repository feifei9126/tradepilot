-- Production hardening: email send quota/idempotency and explicit marketing consent.
-- This migration only adds forward-compatible metadata; it never stores message bodies
-- or provider credentials in plaintext.

CREATE TABLE IF NOT EXISTS email_send_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  recipient_count integer NOT NULL CHECK (recipient_count BETWEEN 1 AND 100),
  marketing boolean NOT NULL DEFAULT false,
  status varchar(20) NOT NULL CHECK (status IN ('pending','sent','failed')),
  provider_message_id varchar(500),
  failure_code varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(company_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS email_send_events_company_day ON email_send_events(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_marketing_consents (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('subscribed','unsubscribed')),
  source varchar(80) NOT NULL,
  policy_version varchar(40),
  subscribed_at timestamptz,
  unsubscribed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, email)
);
CREATE INDEX IF NOT EXISTS email_marketing_consents_active ON email_marketing_consents(company_id, email) WHERE status='subscribed';

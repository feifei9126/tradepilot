-- Forward-only migration: the live CRM API uses versioned JSONB records.
-- Tenant is part of every primary/foreign key, not a client-supplied JSON field.
CREATE TABLE IF NOT EXISTS crm_records (
  company_id uuid NOT NULL REFERENCES companies(id),
  kind text NOT NULL CHECK (kind IN ('contacts','products','inquiries','quotations','orders','shipments','documents','messages','suppliers','tasks','bindings','emails','email_accounts','custom_fields','prospect_personas','prospect_tasks','prospect_leads')),
  id text NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND data->>'id' IS NOT NULL AND data->>'id' = id),
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, kind, id)
);
CREATE INDEX IF NOT EXISTS crm_records_tenant_created ON crm_records(company_id, kind, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS crm_records_document_number ON crm_records(company_id, kind, (data->>'no')) WHERE kind IN ('quotations', 'orders');
CREATE UNIQUE INDEX IF NOT EXISTS crm_one_order_per_quotation ON crm_records(company_id, (data->>'quotationId')) WHERE kind = 'orders' AND data->>'quotationId' IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_one_shipment_per_order ON crm_records(company_id, (data->>'orderId')) WHERE kind = 'shipments';
CREATE UNIQUE INDEX IF NOT EXISTS crm_unique_prospect_source ON crm_records(company_id, (data->>'taskId'), (data->>'sourceUrl')) WHERE kind = 'prospect_leads';
CREATE TABLE IF NOT EXISTS crm_record_links (
  company_id uuid NOT NULL,
  source_kind text NOT NULL, source_id text NOT NULL,
  target_kind text NOT NULL, target_id text NOT NULL,
  PRIMARY KEY(company_id, source_kind, source_id, target_kind, target_id),
  FOREIGN KEY(company_id, source_kind, source_id) REFERENCES crm_records(company_id, kind, id) ON DELETE CASCADE,
  FOREIGN KEY(company_id, target_kind, target_id) REFERENCES crm_records(company_id, kind, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS crm_links_target ON crm_record_links(company_id, target_kind, target_id);
CREATE TABLE IF NOT EXISTS crm_counters (
  company_id uuid NOT NULL REFERENCES companies(id),
  kind text NOT NULL, year integer NOT NULL, value bigint NOT NULL,
  PRIMARY KEY(company_id, kind, year)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id), actor_id text NOT NULL,
  action varchar(100) NOT NULL, target_id text,
  details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_tenant_time ON audit_events(company_id, created_at DESC);
-- Normalize historic case variants only when safe. Refuse ambiguous ownership.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users GROUP BY lower(email) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate case-insensitive emails; resolve accounts before migrating';
  END IF;
END $$;
UPDATE users SET email = lower(trim(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_casefold ON users(lower(email));
CREATE INDEX IF NOT EXISTS users_company ON users(company_id);

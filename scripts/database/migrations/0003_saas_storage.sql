-- Forward-only: extend the tenant store, never rewrite an applied migration.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS member_limit integer NOT NULL DEFAULT 20 CHECK (member_limit BETWEEN 1 AND 10000);
ALTER TABLE crm_records DROP CONSTRAINT IF EXISTS crm_records_kind_check;
ALTER TABLE crm_records ADD CONSTRAINT crm_records_kind_check CHECK (kind IN (
  'contacts','products','inquiries','quotations','orders','shipments','documents','messages',
  'suppliers','tasks','bindings','emails','email_accounts','custom_fields',
  'prospect_personas','prospect_tasks','prospect_leads','product_video_jobs'
));
-- Source identity is workspace-wide, not per campaign. Refuse ambiguity rather
-- than silently discarding existing leads during an upgrade.
CREATE UNIQUE INDEX IF NOT EXISTS crm_unique_workspace_prospect_source
  ON crm_records(company_id, (data->>'sourceUrl')) WHERE kind='prospect_leads';
CREATE INDEX IF NOT EXISTS audit_events_platform_time ON audit_events(created_at DESC);

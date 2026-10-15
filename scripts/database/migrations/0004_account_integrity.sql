-- Forward-only, transactional integrity upgrade for the pre-release SaaS.
-- Existing invalid rows abort this migration: do not delete or invent ownership.
-- This takes table/index locks; use a maintenance window before production use.
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE users ALTER COLUMN settings SET NOT NULL;
ALTER TABLE companies ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_workspace_role CHECK (role IN ('owner','admin','member'));
ALTER TABLE users ADD CONSTRAINT users_settings_object CHECK (jsonb_typeof(settings) = 'object');
ALTER TABLE users ADD CONSTRAINT users_email_normalized CHECK (email = lower(trim(email)) AND length(trim(email)) > 0);
ALTER TABLE users ADD CONSTRAINT users_session_settings CHECK (
  (NOT settings ? 'sessionVersion' OR jsonb_typeof(settings->'sessionVersion') = 'string')
  AND (NOT settings ? 'passwordHash' OR jsonb_typeof(settings->'passwordHash') = 'string')
  AND (NOT settings ? 'mustChangePassword' OR jsonb_typeof(settings->'mustChangePassword') = 'boolean')
);
-- A working document is unique per order/type, even under concurrent retries.
CREATE UNIQUE INDEX crm_one_document_per_order_type ON crm_records(company_id, (data->>'orderId'), (data->>'type')) WHERE kind = 'documents';

import { getPool, isDatabaseConfigured } from "@/db";
import { DATABASE_MIGRATIONS } from "@/db/migrations";

export type AppliedMigration = { version: string; checksum: string; appliedAt: string };
export function compareMigrations(applied: AppliedMigration[]) {
  const known = new Map(applied.map(migration => [migration.version, migration]));
  const migrations = DATABASE_MIGRATIONS.map(expected => {
    const actual = known.get(expected.version);
    return { version: expected.version, appliedAt: actual?.appliedAt ?? null,
      state: !actual ? "pending" as const : actual.checksum === expected.checksum ? "applied" as const : "mismatch" as const };
  });
  const unexpected = applied.filter(actual => !DATABASE_MIGRATIONS.some(expected => expected.version === actual.version)).map(actual => actual.version);
  return { migrations, unexpected };
}
// Check the current release's storage contract, not just users/companies.
const requiredColumns: Record<string, string[]> = {
  companies: ["id", "slug", "name", "is_active", "member_limit"],
  users: ["id", "company_id", "email", "role", "is_active", "settings"],
  crm_records: ["company_id", "kind", "id", "data", "schema_version", "created_at", "updated_at"],
  crm_record_links: ["company_id", "source_kind", "source_id", "target_kind", "target_id"],
  crm_counters: ["company_id", "kind", "year", "value"],
  audit_events: ["id", "company_id", "actor_id", "action", "details", "created_at"],
  tradepilot_migrations: ["version", "checksum", "applied_at"],
  tenant_ai_settings: ["company_id", "provider", "model", "api_key_ciphertext", "monthly_request_limit", "monthly_token_limit"],
  ai_usage_events: ["id", "company_id", "user_id", "status", "reserved_tokens", "tokens_used", "created_at"],
  tenant_webhook_credentials: ["company_id", "secret_ciphertext", "previous_secret_ciphertext", "rotated_at"],
  webhook_events: ["id", "company_id", "event_id", "event_type", "payload_sha256", "received_at"],
  rate_limit_counters: ["scope", "key_hash", "window_start", "hit_count", "expires_at"],
  billing_plans: ["id", "name", "monthly_price_cents", "monthly_request_limit", "monthly_token_limit", "features"],
  billing_accounts: ["company_id", "provider", "status"],
  subscriptions: ["id", "company_id", "plan_id", "status", "billing_interval", "current_period_end"],
  payment_events: ["provider", "event_id", "event_type", "payload_sha256", "status"],
  email_account_secrets: ["company_id", "account_id", "smtp_password_ciphertext", "imap_password_ciphertext"],
  email_sync_state: ["company_id", "account_id", "folder", "last_uid"],
  email_suppressions: ["company_id", "email", "reason", "unsubscribed_at"],
  email_consent_events: ["id", "company_id", "email", "event", "created_at"],
  media_assets: ["id", "company_id", "object_key", "mime_type", "size_bytes", "storage_provider", "status"],
};
const requiredIndexes = ["crm_records_pkey", "crm_record_links_pkey", "crm_one_order_per_quotation", "crm_one_shipment_per_order", "crm_one_document_per_order_type", "crm_unique_workspace_prospect_source", "users_email_casefold", "ai_usage_company_time", "rate_limit_expiry", "webhook_events_company_time", "subscriptions_one_live_per_company", "payment_events_pkey", "email_suppressions_active", "media_assets_company_key"];
export type DatabaseStatus = {
  configured: boolean; connected: boolean; state: "unconfigured" | "unavailable" | "migration-required" | "ready";
  configSource: "DATABASE_URL" | "PG*" | null; sslMode: string | null; schemaReady: boolean;
  tableCount: number; databaseSizeBytes: number | null; checkedAt: string; message: string;
  latestMigration: string | null; lastMigrationAt: string | null;
  migrations: ReturnType<typeof compareMigrations>["migrations"]; unexpectedMigrations: string[];
  missingSchema: string[]; recordCounts: { kind: string; count: number }[];
  totals: { workspaces: number; users: number; records: number; auditEvents: number } | null;
};
export async function readDatabaseStatus(): Promise<DatabaseStatus> {
  const configured = isDatabaseConfigured();
  const result: DatabaseStatus = {
    configured, connected: false, state: configured ? "unavailable" : "unconfigured",
    configSource: !configured ? null : process.env.DATABASE_URL?.trim() ? "DATABASE_URL" : "PG*", sslMode: null,
    schemaReady: false, tableCount: 0, databaseSizeBytes: null, checkedAt: new Date().toISOString(),
    message: configured ? "连接失败或配置无效，请在服务器检查配置、网络和数据库权限；页面不会显示连接凭据。" : "尚未配置数据库。请设置 DATABASE_URL 或 PGHOST/PGDATABASE/PGUSER；业务数据不会退回内存。",
    latestMigration: null, lastMigrationAt: null, migrations: compareMigrations([]).migrations,
    unexpectedMigrations: [], missingSchema: [], recordCounts: [], totals: null,
  };
  if (!configured) return result;
  let client;
  try {
    // This endpoint returns only counts and release identifiers, never record
    // payloads, hostnames, passwords, full URLs or certificate contents.
    client = await getPool().connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    result.connected = true;
    const columns = await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'");
    const tables = new Map<string, Set<string>>();
    for (const row of columns.rows) {
      if (!tables.has(row.table_name)) tables.set(row.table_name, new Set());
      tables.get(row.table_name)!.add(row.column_name);
    }
    const tableCount = await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    result.tableCount = tableCount.rows[0].count;
    for (const [table, expected] of Object.entries(requiredColumns)) {
      for (const column of expected) if (!tables.get(table)?.has(column)) result.missingSchema.push(`${table}.${column}`);
    }
    const indexes = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname='public'");
    for (const index of requiredIndexes) if (!indexes.rows.some(row => row.indexname === index)) result.missingSchema.push(`index:${index}`);
    if (requiredColumns.tradepilot_migrations.every(column => tables.get("tradepilot_migrations")?.has(column))) {
      const applied = await client.query<AppliedMigration>('SELECT version,checksum,applied_at AS "appliedAt" FROM tradepilot_migrations ORDER BY version');
      const compared = compareMigrations(applied.rows);
      result.migrations = compared.migrations;
      result.unexpectedMigrations = compared.unexpected;
      result.latestMigration = applied.rows.at(-1)?.version ?? null;
      result.lastMigrationAt = applied.rows.length ? new Date(Math.max(...applied.rows.map(row => new Date(row.appliedAt).valueOf()))).toISOString() : null;
    }
    result.schemaReady = !result.missingSchema.length && !result.unexpectedMigrations.length && result.migrations.every(migration => migration.state === "applied");
    if (result.schemaReady) {
      const counts = await client.query("SELECT kind,count(*)::int AS count FROM crm_records GROUP BY kind ORDER BY kind");
      result.recordCounts = counts.rows;
      const totals = await client.query('SELECT (SELECT count(*)::int FROM companies) AS workspaces,(SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM crm_records) AS records,(SELECT count(*)::int FROM audit_events) AS "auditEvents"');
      result.totals = totals.rows[0];
    }
    const meta = await client.query("SELECT pg_database_size(current_database())::text AS size,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls");
    result.databaseSizeBytes = Number(meta.rows[0].size);
    result.sslMode = meta.rows[0].tls === true ? "TLS 已启用（校验策略以服务器环境配置为准）" : "未使用 TLS（仅限受信内部网络）";
    await client.query("COMMIT");
    result.state = result.schemaReady ? "ready" : "migration-required";
    result.message = result.schemaReady ? "数据库连接正常，本版本迁移校验通过，租户业务存储已就绪；这不代表全部 SaaS 上线门禁通过。" : "数据库可连接，但结构/迁移与本版本不一致。请先备份，检查迁移校验异常并执行 npm run db:migrate；不要修改已应用的 SQL。";
  } catch {
    await client?.query("ROLLBACK").catch(() => {});
    result.connected = false; result.schemaReady = false; result.state = "unavailable";
    result.totals = null; result.recordCounts = [];
  } finally { client?.release(); }
  return result;
}

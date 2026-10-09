import { postgresPoolConfig } from "../../scripts/database/config.mjs";

export function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim() || process.env.PGHOST?.trim() || process.env.PGDATABASE?.trim());
}
/** Shared resolver prevents web/migration/backup TLS settings from diverging. */
export function getPostgresConfig() {
  return isPostgresConfigured() ? postgresPoolConfig() : null;
}

import postgres, { type Sql } from "postgres";

import { getSql } from "@/db";
import { BusinessError } from "@/lib/business/errors";
import { resolveStorageMode } from "@/lib/business/runtime";

const EXPECTED_MIGRATION_HASH =
  "0681271487953e7446510ba93275384465d5291f8581960cfcee0bcbf5695a2d";

export interface DatabaseHealthResult {
  status: "ok" | "error";
  storage: "memory" | "postgresql" | "not_configured";
  database: "not_used" | "connected" | "unavailable";
  migrations: "not_used" | "current" | "outdated";
  bootstrapRequired: boolean;
}

interface DatabaseHealthOptions {
  nodeEnv?: string;
  databaseUrl?: string;
  sql?: Sql;
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  if ("code" in error) return String(error.code);
  if ("cause" in error) return errorCode(error.cause);
  return "UNKNOWN";
}

export function databaseHealthMessage(health: DatabaseHealthResult) {
  if (health.storage === "not_configured") {
    return "未配置 DATABASE_URL。请添加 PostgreSQL 或 Neon 连接串后重新部署。";
  }
  if (health.database === "unavailable") {
    return "数据库无法连接。请检查连接串、网络访问和 TLS 参数。";
  }
  if (health.migrations === "outdated") {
    return "数据库迁移尚未完成。请先运行 npm run db:migrate。";
  }
  if (health.bootstrapRequired) {
    return "管理员账号尚未初始化。请先运行 npm run db:bootstrap。";
  }
  return null;
}

export async function getDatabaseHealth(
  options: DatabaseHealthOptions = {},
): Promise<DatabaseHealthResult> {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  try {
    const mode = resolveStorageMode({ nodeEnv, databaseUrl });
    if (mode === "memory") {
      return {
        status: "ok",
        storage: "memory",
        database: "not_used",
        migrations: "not_used",
        bootstrapRequired: false,
      };
    }
  } catch (error) {
    if (
      error instanceof BusinessError &&
      error.code === "DATABASE_NOT_CONFIGURED"
    ) {
      return {
        status: "error",
        storage: "not_configured",
        database: "not_used",
        migrations: "not_used",
        bootstrapRequired: false,
      };
    }
    throw error;
  }

  let client: Sql | null = options.sql || null;
  let closeClient = false;
  try {
    if (!client) {
      if (options.databaseUrl && options.databaseUrl !== process.env.DATABASE_URL) {
        client = postgres(options.databaseUrl, { max: 1, prepare: false });
        closeClient = true;
      } else {
        client = getSql();
      }
    }
    if (!client) {
      throw new BusinessError(
        "DATABASE_NOT_CONFIGURED",
        "数据库未配置",
        503,
      );
    }
    await client`SELECT 1`;
    const [migrationTable] = await client<{ exists: boolean }[]>`
      SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists
    `;
    if (!migrationTable?.exists) {
      return {
        status: "error",
        storage: "postgresql",
        database: "connected",
        migrations: "outdated",
        bootstrapRequired: true,
      };
    }
    const [latest] = await client<{ hash: string | null }[]>`
      SELECT hash
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (latest?.hash !== EXPECTED_MIGRATION_HASH) {
      return {
        status: "error",
        storage: "postgresql",
        database: "connected",
        migrations: "outdated",
        bootstrapRequired: true,
      };
    }
    const [owner] = await client<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM users
      WHERE role = 'owner' AND is_active IS NOT FALSE
    `;
    const bootstrapRequired = Number(owner?.count || 0) === 0;
    return {
      status: bootstrapRequired ? "error" : "ok",
      storage: "postgresql",
      database: "connected",
      migrations: "current",
      bootstrapRequired,
    };
  } catch (error) {
    console.error(`[database-health] DATABASE_UNAVAILABLE (${errorCode(error)})`);
    return {
      status: "error",
      storage: "postgresql",
      database: "unavailable",
      migrations: "outdated",
      bootstrapRequired: true,
    };
  } finally {
    if (closeClient && client) await client.end({ timeout: 5 });
  }
}

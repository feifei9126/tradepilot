import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { getPostgresConfig, isPostgresConfigured } from "./config";

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;
export type DatabaseState = "unconfigured" | "ready" | "unavailable";
export class DatabaseUnavailableError extends Error {
  readonly status = 503;
  constructor() { super("数据库未配置或暂时不可用，请联系管理员；数据不会退回内存存储"); }
}
let pool: Pool | undefined;
let db: AppDatabase | undefined;
export const isDatabaseConfigured = () => isPostgresConfigured();

export function getPool(): Pool {
  if (!isDatabaseConfigured()) throw new DatabaseUnavailableError();
  if (!pool) {
    const max = Number(process.env.TRADEPILOT_DB_POOL_MAX || "10");
    pool = new Pool({
      ...getPostgresConfig(),
      max: Number.isInteger(max) && max >= 1 && max <= 100 ? max : 10,
      idleTimeoutMillis: 30_000,
      statement_timeout: 15_000,
    });
    // Never let an idle-client network error crash the web process or log a URL.
    pool.on("error", () => console.error("PostgreSQL idle connection unavailable"));
  }
  return pool;
}
export async function getDb(): Promise<AppDatabase | null> {
  if (!isDatabaseConfigured()) return null;
  db ??= drizzle(getPool(), { schema });
  return db;
}
export async function getDbOrThrow(): Promise<AppDatabase> {
  const value = await getDb();
  if (!value) throw new DatabaseUnavailableError();
  return value;
}
export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  try { return await getPool().query<T>(text, values); }
  catch { throw new DatabaseUnavailableError(); }
}
export async function getDatabaseState(): Promise<DatabaseState> {
  if (!isDatabaseConfigured()) return "unconfigured";
  try { await getPool().query("SELECT 1"); return "ready"; }
  catch { return "unavailable"; }
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try { client = await getPool().connect(); }
  catch { throw new DatabaseUnavailableError(); }
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
export async function closeDbPool() {
  const old = pool; pool = undefined; db = undefined;
  if (old) await old.end();
}
export { schema };

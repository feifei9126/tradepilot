import { randomUUID } from "node:crypto";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate as runDrizzleMigrations } from "drizzle-orm/postgres-js/migrator";
import postgres, { type Sql } from "postgres";

export interface TestDatabaseContext {
  databaseUrl: string;
  migrate(): Promise<void>;
  schemaName: string;
  sql: Sql;
}

function testDatabaseName() {
  return `tradepilot_test_${randomUUID().replaceAll("-", "")}`;
}

export async function withCleanDatabase<T>(
  databaseUrl: string,
  callback: (context: TestDatabaseContext) => Promise<T>,
): Promise<T> {
  const databaseName = testDatabaseName();
  const adminSql = postgres(databaseUrl, {
    max: 1,
    onnotice: () => undefined,
    prepare: false,
  });
  await adminSql.unsafe(`CREATE DATABASE "${databaseName}"`);

  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.pathname = `/${databaseName}`;
  const sql = postgres(isolatedUrl.toString(), {
    max: 1,
    onnotice: () => undefined,
    prepare: false,
  });

  try {
    return await callback({
      databaseUrl: isolatedUrl.toString(),
      schemaName: "public",
      sql,
      async migrate() {
        const db = drizzle(sql);
        await runDrizzleMigrations(db, {
          migrationsFolder: path.join(process.cwd(), "src", "db", "migrations"),
        });
      },
    });
  } finally {
    await sql.end({ timeout: 5 });
    await adminSql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${databaseName} AND pid <> pg_backend_pid()
    `;
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await adminSql.end({ timeout: 5 });
  }
}

import path from "node:path";
import { fileURLToPath } from "node:url";

import { readMigrationFiles } from "drizzle-orm/migrator";

import {
  isMainModule,
  openSql,
  requireDatabaseUrl,
  safeErrorMessage,
} from "./common.mjs";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/db/migrations",
);

function expectedMigrationHash() {
  return readMigrationFiles({ migrationsFolder }).at(-1)?.hash || null;
}

export async function getDatabaseStatus({
  databaseUrl = requireDatabaseUrl(),
} = {}) {
  const sql = openSql(databaseUrl);
  try {
    await sql`SELECT 1`;
    const [migrationTable] = await sql`
      SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists
    `;
    if (!migrationTable.exists) {
      return {
        database: "connected",
        migrations: "outdated",
        bootstrapRequired: true,
      };
    }

    const [latest] = await sql`
      SELECT hash
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const migrations =
      latest?.hash && latest.hash === expectedMigrationHash()
        ? "current"
        : "outdated";
    if (migrations !== "current") {
      return {
        database: "connected",
        migrations,
        bootstrapRequired: true,
      };
    }

    const [owner] = await sql`
      SELECT count(*)::int AS count
      FROM users
      WHERE role = 'owner' AND is_active IS NOT FALSE
    `;
    return {
      database: "connected",
      migrations,
      bootstrapRequired: Number(owner.count) === 0,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (isMainModule(import.meta.url)) {
  getDatabaseStatus()
    .then((status) => console.log(JSON.stringify(status)))
    .catch((error) => {
      console.error(safeErrorMessage(error));
      process.exitCode = 1;
    });
}

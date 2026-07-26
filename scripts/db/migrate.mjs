import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

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

export async function runMigrations({
  databaseUrl = requireDatabaseUrl(),
  log = console.log,
} = {}) {
  const sql = openSql(databaseUrl);
  try {
    await migrate(drizzle(sql), { migrationsFolder });
    log("数据库迁移已是最新状态");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (isMainModule(import.meta.url)) {
  runMigrations().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
}

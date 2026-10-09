import "./database/env.mjs";
import { Pool } from "pg";
import { applyMigrations } from "./database/migrations.mjs";
import { postgresPoolConfig } from "./database/config.mjs";

let databaseConfig;
try { databaseConfig = postgresPoolConfig(); } catch (error) {
  console.error(error instanceof Error ? error.message : "PostgreSQL configuration is required");
  process.exit(1);
}

const pool = new Pool({ ...databaseConfig, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const count = await applyMigrations(pool);
  console.log(`Database migration check complete (${count} migration${count === 1 ? "" : "s"}).`);
} catch {
  console.error("Database migration failed. Check PostgreSQL settings, connectivity, and database permissions.");
  process.exitCode = 1;
} finally {
  await pool.end();
}

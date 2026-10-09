import "./database/env.mjs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { postgresProcessEnv } from "./database/config.mjs";

const archive = process.argv[2] ? resolve(process.argv[2]) : "";
if (!archive || !existsSync(archive)) {
  console.error("Usage: RESTORE_DATABASE_URL='postgresql://...' CONFIRM_RESTORE=I_HAVE_VERIFIED_THE_EMPTY_TARGET npm run db:restore -- backups/file.dump");
  process.exit(1);
}
if (process.env.CONFIRM_RESTORE !== "I_HAVE_VERIFIED_THE_EMPTY_TARGET") {
  console.error("Restore requires an explicit new/empty target and CONFIRM_RESTORE=I_HAVE_VERIFIED_THE_EMPTY_TARGET.");
  process.exit(1);
}
try {
  const env = postgresProcessEnv({ restore: true });
  const objects = execFileSync("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f')`], { env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
  if (objects !== "0") throw new Error("TARGET_NOT_EMPTY");
  // Do not use --clean. Any collision or restore error rolls back the entire
  // archive rather than leaving a half-restored tenant database.
  execFileSync("pg_restore", ["--single-transaction", "--exit-on-error", "--no-owner", "--no-acl", "--dbname", env.PGDATABASE, archive], { env, stdio: "inherit" });
  console.log("Database restore completed in one transaction. Verify migrations, counts and tenant isolation before switching traffic.");
} catch (error) {
  console.error(error?.message === "TARGET_NOT_EMPTY" ? "Restore refused: target contains user objects. Create a new empty database; no data was changed." : error?.code === "ENOENT" ? "psql/pg_restore not found. Install PostgreSQL client tools first." : "Database restore failed. Target credentials must be explicit, reachable and compatible. No automatic overwrite is performed.");
  process.exitCode = 1;
}

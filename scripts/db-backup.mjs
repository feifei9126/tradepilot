import "./database/env.mjs";
import { execFileSync } from "node:child_process";
import { mkdir, open, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { postgresProcessEnv } from "./database/config.mjs";

const output = resolve(process.argv[2] || `backups/tradepilot-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
let created = false;
try {
  const env = postgresProcessEnv();
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  // O_EXCL refuses overwrite/symlinks; mode is private BEFORE pg_dump writes.
  const file = await open(output, "wx", 0o600);
  created = true;
  try {
    execFileSync("pg_dump", ["--format=custom", "--no-owner", "--no-acl"], { env, stdio: ["ignore", file.fd, "inherit"] });
  } finally { await file.close(); }
  console.log(`Database backup created (0600): ${output}`);
  console.log("This backup does not include deployment configuration, video media volumes or browser drafts.");
} catch (error) {
  if (created) await rm(output, { force: true }).catch(() => {});
  console.error(error?.code === "ENOENT" ? "pg_dump was not found. Install PostgreSQL client tools first." : error?.code === "EEXIST" ? "Backup target already exists; choose a new filename." : "Database backup failed. Check PostgreSQL settings and database permissions.");
  process.exitCode = 1;
}

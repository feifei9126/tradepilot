import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = join(fileURLToPath(new URL(".", import.meta.url)), "migrations");
export async function readMigrationFiles(directory = migrationsDir) {
  const versions = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  return Promise.all(versions.map(async version => {
    const contents = await readFile(join(directory, version), "utf8");
    return { version, contents, checksum: createHash("sha256").update(contents).digest("hex") };
  }));
}
export function validateAppliedMigrations(files, applied) {
  const known = new Map(files.map(file => [file.version, file.checksum]));
  for (const row of applied) {
    if (!known.has(row.version)) throw new Error(`Unknown applied migration ${row.version}; refusing to downgrade this database`);
    if (known.get(row.version) !== row.checksum) throw new Error(`Applied migration ${row.version} was modified; add a new forward migration instead`);
  }
  const installed = new Set(applied.map(row => row.version));
  let gap = false;
  for (const file of files) {
    if (!installed.has(file.version)) gap = true;
    else if (gap) throw new Error("Applied migrations are not a contiguous prefix; repair the migration history before proceeding");
  }
}
export async function applyMigrations(pool) {
  const files = await readMigrationFiles();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(79443120)");
    await client.query(`CREATE TABLE IF NOT EXISTS tradepilot_migrations (
      version varchar(120) PRIMARY KEY, checksum char(64) NOT NULL,
      applied_at timestamp with time zone NOT NULL DEFAULT NOW()
    )`);
    const applied = (await client.query("SELECT version,checksum FROM tradepilot_migrations ORDER BY version")).rows;
    // Preflight ALL installed versions before any pending SQL is executed.
    validateAppliedMigrations(files, applied);
    const installed = new Set(applied.map(row => row.version));
    for (const { version, contents, checksum } of files) {
      if (installed.has(version)) continue;
      await client.query("BEGIN");
      try {
        await client.query(contents);
        await client.query("INSERT INTO tradepilot_migrations (version, checksum) VALUES ($1, $2)", [version, checksum]);
        await client.query("COMMIT");
        console.log(`Applied database migration ${version}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }
    return files.length;
  } finally {
    await client.query("SELECT pg_advisory_unlock(79443120)").catch(() => {});
    client.release();
  }
}

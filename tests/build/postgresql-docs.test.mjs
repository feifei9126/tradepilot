import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("README documents production database and one-command deployment modes", async () => {
  const readme = await readFile(new URL("../../README.md", import.meta.url), "utf8");

  assert.match(readme, /生产环境.*(?:强制|必须).*PostgreSQL/s);
  assert.match(readme, /npm run dev.*内存演示/s);
  assert.match(readme, /TRADEPILOT_SEED_DEMO=true/);
  assert.match(readme, /bash install\.sh/);
  assert.match(readme, /npm run setup:cloudflare/);
  assert.match(readme, /docs\/postgresql-deployment\.md/);
});

test("PostgreSQL deployment guide covers upgrades and safe troubleshooting", async () => {
  const guide = await readFile(
    new URL("../../docs/postgresql-deployment.md", import.meta.url),
    "utf8",
  );

  for (const expected of [
    "Neon",
    "companies",
    "users",
    "DATABASE_NOT_CONFIGURED",
    "DATABASE_UNAVAILABLE",
    "DATABASE_SCHEMA_OUTDATED",
    "bootstrapRequired",
    "npm run db:migrate",
    "npm run db:bootstrap",
    "Cloudflare Git",
  ]) {
    assert.match(guide, new RegExp(expected));
  }
});

test("package scripts expose local, database, deploy, coverage and verification tiers", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );

  assert.match(packageJson.scripts.test, /tests\/repositories\/memory-contract/);
  assert.match(packageJson.scripts["test:db"], /tests\/database/);
  assert.match(packageJson.scripts["test:db"], /postgres\*\.test/);
  assert.match(packageJson.scripts["test:deploy"], /tests\/deploy/);
  assert.match(packageJson.scripts["test:coverage"], /experimental-test-coverage/);
  assert.match(packageJson.scripts.verify, /npm test/);
  assert.match(packageJson.scripts.verify, /npm run build/);
});

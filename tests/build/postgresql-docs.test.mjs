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
  assert.match(readme, /mail-worker/);
  assert.match(readme, /\/app\/email\/settings/);
  assert.match(readme, /\/app\/settings\/payments/);
  assert.match(readme, /\.env\.cloudflare/);
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
    "TRADEPILOT_CREDENTIALS_KEY",
    "TRADEPILOT_CRON_SECRET",
    "/api/webhooks/email/resend",
    "/api/webhooks/payments/<provider>/<publicAccountId>",
  ]) {
    assert.match(guide, new RegExp(expected));
  }
  assert.match(guide, /每 5 分钟/);
  assert.match(guide, /mail-worker/);
});

test("mail worker guide documents SMTP, IMAP, health checks and required secrets", async () => {
  const guide = await readFile(
    new URL("../../workers/mail-worker/README.md", import.meta.url),
    "utf8",
  );

  for (const expected of [
    "SMTP",
    "IMAP",
    "DATABASE_URL",
    "TRADEPILOT_CREDENTIALS_KEY",
    "MAIL_WORKER_INTERVAL_MS",
    "/health",
    "docker compose",
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

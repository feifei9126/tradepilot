import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("email workspace selects an account for drafts and sends", async () => {
  const source = await readFile(new URL("src/app/app/email/page.tsx", root), "utf8");
  assert.match(source, /fetch\(["']\/api\/email\/accounts["']/);
  assert.match(source, /accountId\s*:/);
  assert.match(source, /submitMessage\(["']send["']\)/);
});

test("email settings supports SMTP credentials and Resend configuration", async () => {
  const source = await readFile(new URL("src/app/app/email/settings/page.tsx", root), "utf8");
  assert.match(source, /smtp_imap/);
  assert.match(source, /resend/);
  assert.match(source, /password/);
  assert.match(source, /apiKey/);
  assert.match(source, /webhookSecret/);
});

test("Cloudflare worker schedules Resend outbox processing", async () => {
  const config = await readFile(new URL("wrangler.jsonc", root), "utf8");
  const wrapper = await readFile(new URL("cloudflare-worker.ts", root), "utf8");
  await access(new URL("src/app/api/internal/email/outbox/route.ts", root));
  assert.match(config, /"main"\s*:\s*"cloudflare-worker\.ts"/);
  assert.match(config, /"crons"\s*:\s*\[/);
  assert.match(wrapper, /scheduled\s*\(/);
  assert.match(wrapper, /WORKER_SELF_REFERENCE\.fetch/);
  assert.match(wrapper, /TRADEPILOT_CRON_SECRET/);
});

test("mail worker isolates invalid credentials to the affected IMAP account", async () => {
  const source = await readFile(new URL("workers/mail-worker/server.mjs", root), "utf8");
  assert.match(source, /async function syncAccount[\s\S]*?let credentials\s*=\s*\{\}[\s\S]*?try\s*\{[\s\S]*?credentials\s*=\s*await decryptCredentials/);
});

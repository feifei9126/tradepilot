import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("public checkout returns the safe attempt view", async () => {
  const source = await readFile(new URL("src/app/api/public/payments/[token]/route.ts", root), "utf8");
  assert.match(source, /toPaymentAttemptView\(attempt\)/);
  assert.doesNotMatch(source, /NextResponse\.json\(\{\s*attempt\s*\}\)/);
});

test("refund route creates the adapter selected by the payment account", async () => {
  const source = await readFile(new URL("src/app/api/payment-requests/[id]/refunds/route.ts", root), "utf8");
  assert.match(source, /createPaymentProvider\(account\.provider, credentials\)/);
  assert.doesNotMatch(source, /account\.provider\s*!==\s*["']stripe["']/);
});

test("payment migration creates referenced unique indexes before composite foreign keys", async () => {
  const source = await readFile(new URL("src/db/migrations/0003_order_payments.sql", root), "utf8");
  const accountIndex = source.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS "payment_accounts_company_id_unique"');
  const accountForeignKey = source.indexOf('ADD CONSTRAINT "payment_attempts_account_fk"');
  const requestIndex = source.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_company_id_unique"');
  const requestForeignKey = source.indexOf('ADD CONSTRAINT "payment_attempts_request_fk"');
  const attemptIndex = source.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_company_id_unique"');
  const attemptForeignKey = source.indexOf('ADD CONSTRAINT "payment_refunds_attempt_fk"');

  assert.ok(accountIndex >= 0 && accountIndex < accountForeignKey);
  assert.ok(requestIndex >= 0 && requestIndex < requestForeignKey);
  assert.ok(attemptIndex >= 0 && attemptIndex < attemptForeignKey);
});

test("payment webhook account identifiers are globally unique", async () => {
  const schema = await readFile(new URL("src/db/schema/payment_accounts.ts", root), "utf8");
  const migration = await readFile(new URL("src/db/migrations/0003_order_payments.sql", root), "utf8");

  assert.match(schema, /uniqueIndex\("payment_accounts_public_id_unique"\)\.on\(table\.publicAccountId\)/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "payment_accounts_public_id_unique" ON "payment_accounts" \("public_account_id"\)/);
});

test("payment settings can update encrypted account credentials", async () => {
  const source = await readFile(new URL("src/app/app/settings/payments/page.tsx", root), "utf8");

  assert.match(source, /editingId/);
  assert.match(source, /method:\s*editingId\s*\?\s*"PATCH"\s*:\s*"POST"/);
  assert.match(source, /\.\.\.\(editingId\s*\?\s*\{\s*id:\s*editingId\s*\}\s*:\s*\{\}\)/);
});

test("order payment link actions render readable Chinese text", async () => {
  const source = await readFile(new URL("src/app/app/orders/[id]/page.tsx", root), "utf8");
  assert.match(source, /创建收款链接/);
  assert.match(source, /收款链接已复制/);
  assert.doesNotMatch(source, /鏀舵|閾炬|鍒涘|澶辫|宸插/);
});

test("Alipay webhook acknowledges accepted callbacks with the required response body", async () => {
  const source = await readFile(new URL("src/app/api/webhooks/payments/[provider]/[accountId]/route.ts", root), "utf8");
  assert.match(source, /provider\s*===\s*["']alipay["'][\s\S]*new Response\(["']success["']/);
});

import assert from "node:assert/strict";
import { sealSecret } from "../../src/lib/security/envelope";
import test from "node:test";

import {
  ResendEmailProvider,
  type ResendProviderError,
} from "../../src/lib/email/providers/resend";
import { createMemoryEmailRepository } from "../../src/lib/email/repository";
import { createOutboxItem, OUTBOX_RETRY_DELAYS_MS, processEmailOutbox } from "../../src/lib/email/outbox";

const COMPANY_ID = "10000000-0000-4000-8000-000000000101";
const ACCOUNT_ID = "10000000-0000-4000-8000-000000000102";
const CREDENTIALS_KEY = Buffer.alloc(32, 9).toString("base64url");

function testAccount() {
  const now = new Date(0).toISOString();
  return {
    id: ACCOUNT_ID,
    companyId: COMPANY_ID,
    name: "Sales",
    email: "sales@example.com",
    provider: "resend" as const,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: true,
    imapHost: null,
    imapPort: null,
    imapSecure: true,
    imapMailbox: null,
    encryptedCredentials: "",
    credentialsConfigured: true,
    status: "active" as const,
    healthStatus: "unknown" as const,
    lastError: null,
    syncCursor: {},
    createdAt: now,
    updatedAt: now,
  };
}

test("Resend provider sends the validated message and returns external id", async () => {
  const apiKey = "re_test_secret_value";
  let request: { url: string; init: RequestInit } | undefined;
  const provider = new ResendEmailProvider({
    apiKey,
    fetch: async (url, init) => {
      request = { url: String(url), init: init || {} };
      return new Response(JSON.stringify({ id: "resend_123" }), { status: 200 });
    },
  });

  const result = await provider.send({
    from: "sales@example.com",
    to: ["buyer@example.com"],
    subject: "Quote",
    html: "<p>Hello</p>",
    text: "Hello",
  });

  assert.equal(result.externalId, "resend_123");
  assert.equal(request?.url, "https://api.resend.com/emails");
  assert.equal((request?.init.headers as Record<string, string>).Authorization, `Bearer ${apiKey}`);
  const body = JSON.parse(String(request?.init.body)) as Record<string, unknown>;
  assert.deepEqual(body, {
    from: "sales@example.com",
    to: ["buyer@example.com"],
    subject: "Quote",
    html: "<p>Hello</p>",
    text: "Hello",
  });
  assert.equal(JSON.stringify(body).includes(apiKey), false);
});

test("Resend provider classifies rate limits as retryable without leaking api key", async () => {
  const apiKey = "re_test_super_secret";
  const provider = new ResendEmailProvider({
    apiKey,
    fetch: async () => new Response(JSON.stringify({ error: { name: "rate_limit_exceeded" } }), { status: 429 }),
  });

  await assert.rejects(
    provider.send({ from: "sales@example.com", to: "buyer@example.com", subject: "Quote", html: "<p>x</p>", text: "x" }),
    (error: unknown) => {
      const typed = error as ResendProviderError;
      assert.equal(typed.retryable, true);
      assert.equal(typed.code, "PROVIDER_RATE_LIMITED");
      assert.equal(String(typed.message).includes(apiKey), false);
      return true;
    },
  );
});

test("Resend provider treats ordinary client errors as permanent", async () => {
  const provider = new ResendEmailProvider({
    apiKey: "re_test_secret",
    fetch: async () => new Response(JSON.stringify({ error: { name: "invalid_parameter" } }), { status: 400 }),
  });

  await assert.rejects(
    provider.send({ from: "sales@example.com", to: "buyer@example.com", subject: "Quote", html: "<p>x</p>", text: "x" }),
    (error: unknown) => {
      const typed = error as ResendProviderError;
      assert.equal(typed.retryable, false);
      assert.equal(typed.code, "PROVIDER_INVALID_REQUEST");
      return true;
    },
  );
});

test("outbox retries temporary failures with the documented backoff and does not log secrets", async () => {
  const repository = createMemoryEmailRepository();
  const account = testAccount();
  account.encryptedCredentials = JSON.stringify(await sealSecret(JSON.stringify({ apiKey: "re_outbox_secret" }), CREDENTIALS_KEY, { companyId: COMPANY_ID, recordId: ACCOUNT_ID, purpose: "email" }));
  await repository.createAccount(account);
  const item = createOutboxItem({
    companyId: COMPANY_ID,
    accountId: ACCOUNT_ID,
    idempotencyKey: "outbox-1",
    payload: { to: "buyer@example.com", subject: "Quote", text: "Hello", html: "<p>Hello</p>" },
    createdBy: null,
    nextAttemptAt: new Date(0).toISOString(),
  });
  await repository.enqueue(item);
  const now = new Date(0);
  const results = await processEmailOutbox({
    repository,
    now,
    credentialsKey: CREDENTIALS_KEY,
    adapterForAccount: async () => ({
      send: async () => {
        throw new Error("temporary transport failure");
      },
    }),
  });
  assert.equal(results[0]?.status, "retry");
  const stored = (await repository.leaseOutbox({ now: new Date(now.getTime() + OUTBOX_RETRY_DELAYS_MS[0]).toISOString(), leasedUntil: new Date(now.getTime() + 10_000).toISOString(), limit: 1 }))[0];
  assert.equal(stored?.attemptCount, 1);
  assert.equal(stored?.lastError?.includes("re_outbox_secret"), false);
});

test("outbox leases can be reclaimed after a worker lease expires", async () => {
  const repository = createMemoryEmailRepository();
  const account = testAccount();
  account.encryptedCredentials = JSON.stringify(await sealSecret(JSON.stringify({ apiKey: "re_lease_secret" }), CREDENTIALS_KEY, { companyId: COMPANY_ID, recordId: ACCOUNT_ID, purpose: "email" }));
  await repository.createAccount(account);
  await repository.enqueue(createOutboxItem({
    companyId: COMPANY_ID,
    accountId: ACCOUNT_ID,
    idempotencyKey: "outbox-lease-expiry",
    payload: { to: "buyer@example.com", subject: "Quote", text: "Hello", html: "<p>Hello</p>" },
    createdBy: null,
    status: "leased",
    nextAttemptAt: new Date(0).toISOString(),
    leasedUntil: new Date(1_000).toISOString(),
  }));
  const leased = await repository.leaseOutbox({
    now: new Date(2_000).toISOString(),
    leasedUntil: new Date(3_000).toISOString(),
    limit: 1,
  });
  assert.equal(leased.length, 1);
  assert.equal(leased[0]?.status, "leased");
  assert.equal(leased[0]?.leasedUntil, new Date(3_000).toISOString());
});

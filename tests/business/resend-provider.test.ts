import assert from "node:assert/strict";
import test from "node:test";

import {
  ResendEmailProvider,
  type ResendProviderError,
} from "../../src/lib/email/providers/resend";

test("Resend provider sends the validated message and returns external id", async () => {
  const apiKey = "re_test_secret_value";
  let request: { url: string; init: RequestInit } | undefined;
  const provider = new ResendEmailProvider({
    apiKey,
    fetch: async (url, init) => {
      request = { url: String(url), init };
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

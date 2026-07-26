import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { createMemoryEmailRepository } from "../../src/lib/email/repository";
import {
  ingestInboundEmail,
  normalizeCloudflareInboundEmail,
  normalizeInboundEmail,
  verifyResendWebhookSignature,
} from "../../src/lib/email/inbound";

const COMPANY_ID = "10000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "10000000-0000-4000-8000-000000000002";
const THREAD_ID = "10000000-0000-4000-8000-000000000003";

test("raw MIME is normalized and dangerous html is removed", async () => {
  const normalized = await normalizeInboundEmail({
    companyId: COMPANY_ID,
    accountId: ACCOUNT_ID,
    threadId: THREAD_ID,
    provider: "resend",
    providerMessageId: "<message-1@example.com>",
    rawMime: [
      "From: Buyer <buyer@example.com>",
      "To: Sales <sales@example.com>",
      "Subject: Request",
      "Date: Tue, 01 Jul 2025 12:00:00 +0000",
      "Message-ID: <message-1@example.com>",
      "Content-Type: multipart/alternative; boundary=abc",
      "",
      "--abc",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Please quote.",
      "--abc",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>Please quote.</p><script>alert(1)</script><a href=\"javascript:alert(2)\">bad</a>",
      "--abc--",
      "",
    ].join("\r\n"),
  });

  assert.equal(normalized.subject, "Request");
  assert.equal(normalized.from[0]?.email, "buyer@example.com");
  assert.equal(normalized.textBody, "Please quote.");
  assert.match(normalized.htmlBody || "", /Please quote/);
  assert.equal(/script|javascript:/i.test(normalized.htmlBody || ""), false);
  assert.equal(normalized.normalizedMessageKey, "message:<message-1@example.com>");
});

test("missing Message-ID gets a stable account-scoped fallback key", async () => {
  const input = {
    companyId: COMPANY_ID,
    accountId: ACCOUNT_ID,
    threadId: THREAD_ID,
    provider: "resend" as const,
    rawMime: "From: buyer@example.com\r\nTo: sales@example.com\r\nSubject: Hello\r\nDate: Tue, 01 Jul 2025 12:00:00 +0000\r\n\r\nBody",
  };
  const first = await normalizeInboundEmail(input);
  const second = await normalizeInboundEmail(input);
  assert.equal(first.normalizedMessageKey, second.normalizedMessageKey);
  assert.match(first.normalizedMessageKey, /^fallback:/);
});

test("provider events are idempotent and do not insert inbound message twice", async () => {
  const repository = createMemoryEmailRepository();
  const input = {
    companyId: COMPANY_ID,
    accountId: ACCOUNT_ID,
    threadId: THREAD_ID,
    provider: "resend" as const,
    providerEventId: "evt_123",
    rawMime: "From: buyer@example.com\r\nTo: sales@example.com\r\nSubject: Hello\r\n\r\nBody",
  };

  const first = await ingestInboundEmail({ ...input, repository });
  const second = await ingestInboundEmail({ ...input, repository });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal((await repository.listMessages(COMPANY_ID, { accountId: ACCOUNT_ID })).length, 1);
});

test("provider event is claimed before message insertion and body changes stay idempotent", async () => {
  const repository = createMemoryEmailRepository();
  const input = {
    companyId: COMPANY_ID,
    accountId: ACCOUNT_ID,
    provider: "resend" as const,
    providerEventId: "evt_stable",
    rawMime: "From: buyer@example.com\r\nTo: sales@example.com\r\nSubject: First\r\n\r\nOne",
  };
  const first = await ingestInboundEmail({ ...input, repository });
  const second = await ingestInboundEmail({ ...input, rawMime: input.rawMime.replace("First", "Changed").replace("One", "Two"), repository });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.message, null);
  assert.equal((await repository.listMessages(COMPANY_ID, { accountId: ACCOUNT_ID })).length, 1);
});

test("Cloudflare Email Routing input maps to the same normalized structure", async () => {
  const normalized = await normalizeCloudflareInboundEmail({
    companyId: COMPANY_ID,
    accountId: ACCOUNT_ID,
    threadId: THREAD_ID,
    from: "Buyer <buyer@example.com>",
    to: "sales@example.com",
    headers: { subject: "Routing", date: "Tue, 01 Jul 2025 12:00:00 +0000" },
    raw: "From: buyer@example.com\r\nTo: sales@example.com\r\nSubject: Routing\r\n\r\nBody",
  });
  assert.equal(normalized.subject, "Routing");
  assert.equal(normalized.from[0]?.email, "buyer@example.com");
  assert.equal(normalized.to[0]?.email, "sales@example.com");
  assert.equal(normalized.textBody, "Body");
});

test("HTML-only Cloudflare input without a date has a stable fallback key", async () => {
  const first = await normalizeCloudflareInboundEmail({
    companyId: COMPANY_ID,
    accountId: ACCOUNT_ID,
    from: "buyer@example.com",
    to: "sales@example.com",
    subject: "HTML only",
    html: "<p>Hello</p>",
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const second = await normalizeCloudflareInboundEmail({
    companyId: COMPANY_ID,
    accountId: ACCOUNT_ID,
    from: "buyer@example.com",
    to: "sales@example.com",
    subject: "HTML only",
    html: "<p>Hello</p>",
  });
  assert.equal(first.normalizedMessageKey, second.normalizedMessageKey);
  assert.equal(first.htmlBody, "<p>Hello</p>");
});

test("Svix webhook signatures require a valid timestamp window", () => {
  const rawBody = JSON.stringify({ id: "evt_1" });
  const id = "msg_1";
  const timestamp = "1751371200";
  const secret = `whsec_${Buffer.from("webhook-secret").toString("base64")}`;
  const signature = createHmac("sha256", Buffer.from("webhook-secret"))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  const headers = {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
  };
  assert.equal(verifyResendWebhookSignature({ rawBody, headers, secret, now: 1751371200 }), true);
  assert.equal(verifyResendWebhookSignature({ rawBody, headers, secret, now: 1751371801 }), false);
  assert.equal(verifyResendWebhookSignature({ rawBody: `${rawBody}x`, headers, secret, now: 1751371200 }), false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryEmailRepository } from "../../src/lib/email/repository";

test("same provider message id is stored once per account", async () => {
  const repository = createMemoryEmailRepository();
  const input = {
    companyId: "10000000-0000-4000-8000-000000000001",
    accountId: "10000000-0000-4000-8000-000000000002",
    threadId: "10000000-0000-4000-8000-000000000003",
    normalizedMessageKey: "provider:message-123",
    providerMessageId: "message-123",
    direction: "inbound" as const,
    folder: "inbox" as const,
    from: [{ email: "buyer@example.com", name: "Buyer" }],
    to: [{ email: "sales@example.com", name: "Sales" }],
    cc: [],
    bcc: [],
    subject: "Request for quotation",
    textBody: "Please quote 100 units.",
    htmlBody: null,
    sentAt: new Date(0).toISOString(),
  };

  const first = await repository.insertInboundMessage(input);
  const second = await repository.insertInboundMessage(input);

  assert.equal(first.id, second.id);
  assert.equal((await repository.listMessages(input.companyId, { accountId: input.accountId })).length, 1);
});

test("a provided thread id cannot cross email accounts", async () => {
  const repository = createMemoryEmailRepository();
  const base = {
    companyId: "10000000-0000-4000-8000-000000000001",
    threadId: "10000000-0000-4000-8000-000000000099",
    providerMessageId: null,
    direction: "inbound" as const,
    folder: "inbox" as const,
    from: [{ email: "buyer@example.com" }],
    to: [{ email: "sales@example.com" }],
    cc: [], bcc: [], subject: "Thread", textBody: "Body", htmlBody: null,
  };
  await repository.insertInboundMessage({ ...base, accountId: "10000000-0000-4000-8000-000000000002", normalizedMessageKey: "one" });
  await assert.rejects(() => repository.insertInboundMessage({ ...base, accountId: "10000000-0000-4000-8000-000000000003", normalizedMessageKey: "two" }), /does not belong/i);
  assert.equal((await repository.listMessages(base.companyId)).length, 1);
});

test("outbound drafts are visible in the draft folder", async () => {
  const repository = createMemoryEmailRepository();
  const companyId = "10000000-0000-4000-8000-000000000011";
  const accountId = "10000000-0000-4000-8000-000000000012";
  const now = new Date(0).toISOString();
  await repository.createAccount({
    id: accountId,
    companyId,
    name: "Sales",
    email: "sales@example.com",
    provider: "resend",
    smtpHost: null,
    smtpPort: null,
    smtpSecure: true,
    imapHost: null,
    imapPort: null,
    imapSecure: true,
    imapMailbox: null,
    encryptedCredentials: "sealed",
    credentialsConfigured: true,
    status: "active",
    healthStatus: "unknown",
    lastError: null,
    syncCursor: {},
    createdAt: now,
    updatedAt: now,
  });

  const draft = await repository.saveOutboundMessage({
    companyId,
    accountId,
    threadId: "10000000-0000-4000-8000-000000000013",
    normalizedMessageKey: "draft:one",
    externalId: null,
    folder: "draft",
    from: [{ email: "sales@example.com" }],
    to: [{ email: "buyer@example.com" }],
    cc: [],
    bcc: [],
    subject: "Draft quote",
    textBody: "Draft body",
    htmlBody: null,
    status: "draft",
    sentAt: null,
  });

  assert.equal(draft.folder, "draft");
  assert.deepEqual((await repository.listMessages(companyId, { folder: "draft" })).map((message) => message.id), [draft.id]);
});

test("Resend webhook account lookup requires one unique active recipient", async () => {
  const repository = createMemoryEmailRepository();
  const now = new Date(0).toISOString();
  const base = {
    name: "Inbound",
    email: "inbound@example.com",
    provider: "resend" as const,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: true,
    imapHost: null,
    imapPort: null,
    imapSecure: true,
    imapMailbox: null,
    encryptedCredentials: "sealed",
    credentialsConfigured: true,
    status: "active" as const,
    healthStatus: "unknown" as const,
    lastError: null,
    syncCursor: {},
    createdAt: now,
    updatedAt: now,
  };
  const first = await repository.createAccount({ ...base, id: "10000000-0000-4000-8000-000000000021", companyId: "10000000-0000-4000-8000-000000000022" });

  assert.equal((await repository.findActiveResendAccountByEmail("Inbound@Example.com"))?.id, first.id);

  await repository.createAccount({ ...base, id: "10000000-0000-4000-8000-000000000023", companyId: "10000000-0000-4000-8000-000000000024" });
  assert.equal(await repository.findActiveResendAccountByEmail("inbound@example.com"), null);
});

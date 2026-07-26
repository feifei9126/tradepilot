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

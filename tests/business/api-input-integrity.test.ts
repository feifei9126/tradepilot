import assert from "node:assert/strict";
import test from "node:test";

import { POST as saveCustomFields } from "../../src/app/api/custom-fields/route";
import { POST as saveEmailAccount } from "../../src/app/api/email/accounts/route";
import { POST as createInquiry } from "../../src/app/api/inquiries/route";
import { POST as createMessage } from "../../src/app/api/messages/route";
import { POST as createProduct } from "../../src/app/api/products/route";

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("product creation rejects an overlong product name", async () => {
  const response = await createProduct(
    jsonRequest("/api/products", { name: "x".repeat(201) }) as never,
  );
  assert.equal(response.status, 400);
});

test("inquiries and messages reject nonexistent contact links", async () => {
  const inquiryResponse = await createInquiry(
    jsonRequest("/api/inquiries", {
      customer: "Test buyer",
      subject: "Test inquiry",
      content: "Please quote",
      contactId: "missing-contact",
    }) as never,
  );
  const messageResponse = await createMessage(
    jsonRequest("/api/messages", {
      contactName: "Test buyer",
      content: "Hello",
      direction: "in",
      contactId: "missing-contact",
    }) as never,
  );

  assert.equal(inquiryResponse.status, 400);
  assert.equal(messageResponse.status, 400);
});

test("email account drafts validate email addresses and ports", async () => {
  const response = await saveEmailAccount(
    jsonRequest("/api/email/accounts", {
      name: "Invalid account",
      email: "not-an-email",
      imapHost: "imap.example.com",
      imapPort: 70_000,
      smtpHost: "smtp.example.com",
      smtpPort: 465,
    }),
  );

  assert.equal(response.status, 400);
});

test("custom field drafts reject duplicate keys and unknown properties", async () => {
  const duplicate = await saveCustomFields(
    jsonRequest("/api/custom-fields", {
      entityType: "contact",
      fields: [
        { id: "f1", name: "等级", key: "grade", type: "text", order: 0 },
        { id: "f2", name: "备用等级", key: "grade", type: "text", order: 1 },
      ],
    }) as never,
  );
  const unknownProperty = await saveCustomFields(
    jsonRequest("/api/custom-fields", {
      entityType: "contact",
      fields: [],
      admin: true,
    }) as never,
  );

  assert.equal(duplicate.status, 400);
  assert.equal(unknownProperty.status, 400);
});

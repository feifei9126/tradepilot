import assert from "node:assert/strict";
import test from "node:test";

import { toEmailAccountView } from "../../src/lib/email/views";

test("email credentials are never returned in account view", () => {
  const view = toEmailAccountView({
    id: "10000000-0000-4000-8000-000000000001",
    companyId: "10000000-0000-4000-8000-000000000002",
    name: "Sales",
    email: "sales@example.com",
    provider: "smtp_imap",
    smtpHost: "smtp.example.com",
    smtpPort: 465,
    imapHost: "imap.example.com",
    imapPort: 993,
    encryptedCredentials: "sealed-password",
    credentialsConfigured: true,
    status: "active",
    healthStatus: "unknown",
    lastError: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });

  assert.equal("password" in view, false);
  assert.equal("encryptedCredentials" in view, false);
  assert.equal(view.credentialsConfigured, true);
});

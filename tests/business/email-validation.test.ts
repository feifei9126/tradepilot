import assert from "node:assert/strict";
import test from "node:test";

import { POST as submitEmail } from "../../src/app/api/email/route";
import { BusinessError } from "../../src/lib/business/errors";
import { createMemoryEmailRepository } from "../../src/lib/email/repository";
import {
  createEmailAccount,
  openEmailAccountCredentials,
} from "../../src/lib/email/service";
import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  parseEmailAccountInput,
  parseEmailMessageInput,
} from "../../src/lib/email/validation";
import { businessRequest } from "../helpers/business-context";

const smtpAccount = {
  name: " Sales ",
  email: " SALES@Example.COM ",
  provider: "smtp_imap",
  smtpHost: " SMTP.Example.COM ",
  smtpPort: "465",
  imapHost: " IMAP.Example.COM ",
  imapPort: 993,
  imapMailbox: " INBOX ",
  username: " sales@example.com ",
  password: "application-password",
};

function validationError(operation: () => unknown) {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof BusinessError && error.code === "VALIDATION_ERROR",
  );
}

test("SMTP and IMAP account input is normalized", () => {
  const account = parseEmailAccountInput(smtpAccount);

  assert.deepEqual(account, {
    name: "Sales",
    email: "sales@example.com",
    provider: "smtp_imap",
    smtpHost: "smtp.example.com",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "imap.example.com",
    imapPort: 993,
    imapSecure: true,
    imapMailbox: "INBOX",
    status: "active",
    credentials: {
      username: "sales@example.com",
      password: "application-password",
    },
  });
});

test("Resend account input does not accept SMTP or IMAP configuration", () => {
  const account = parseEmailAccountInput({
    name: "Transactional",
    email: "mail@example.com",
    provider: "resend",
    apiKey: "re_test_key",
  });

  assert.equal(account.provider, "resend");
  assert.equal(account.smtpHost, null);
  assert.equal(account.smtpPort, null);
  assert.equal(account.imapHost, null);
  assert.equal(account.imapPort, null);
  assert.deepEqual(account.credentials, { apiKey: "re_test_key" });

  validationError(() =>
    parseEmailAccountInput({
      name: "Transactional",
      email: "mail@example.com",
      provider: "resend",
      apiKey: "re_test_key",
      smtpHost: "smtp.example.com",
    }),
  );
});

test("invalid mailbox addresses are rejected", () => {
  for (const email of [
    "",
    "plain-address",
    "missing@domain",
    "two@@example.com",
    "foo.@example.com",
    `${"a".repeat(65)}@example.com`,
    "sales @example.com",
    "sales@ example.com",
    "sales@例子.com",
  ]) {
    validationError(() => parseEmailAccountInput({ ...smtpAccount, email }));
  }
});

test("unsafe mail hosts are rejected", () => {
  for (const host of [
    "",
    "smtp example.com",
    "smtp.例子.com",
    "localhost",
    "mail.localhost",
    "127.0.0.1",
    "[::1]",
    "169.254.169.254",
    "metadata.google.internal",
    "instance-data.ec2.internal",
    "10.0.0.1",
    "172.16.10.20",
    "192.168.1.2",
    "mailserver",
    "mail.internal",
    "mail.local",
    "mail.corp",
    "mail.private",
  ]) {
    validationError(() =>
      parseEmailAccountInput({ ...smtpAccount, smtpHost: host }),
    );
  }
});

test("private mail hosts require explicit opt-in", () => {
  const account = parseEmailAccountInput(
    {
      ...smtpAccount,
      smtpHost: "192.168.1.2",
      imapHost: "mail.internal",
    },
    { TRADEPILOT_ALLOW_PRIVATE_MAIL_HOSTS: "true" },
  );

  assert.equal(account.smtpHost, "192.168.1.2");
  assert.equal(account.imapHost, "mail.internal");
});

test("mail ports use the SMTP and IMAP allowlists", () => {
  for (const smtpPort of [0, 25, 143, 993, 2525, 65_536, "not-a-port"]) {
    validationError(() =>
      parseEmailAccountInput({ ...smtpAccount, smtpPort }),
    );
  }
  for (const imapPort of [0, 25, 465, 587, 995, 65_536, "not-a-port"]) {
    validationError(() =>
      parseEmailAccountInput({ ...smtpAccount, imapPort }),
    );
  }

  assert.equal(
    parseEmailAccountInput({ ...smtpAccount, smtpPort: 587 }).smtpSecure,
    false,
  );
  assert.equal(
    parseEmailAccountInput({ ...smtpAccount, imapPort: 143 }).imapSecure,
    false,
  );
});

test("message subjects and attachment sizes are bounded", () => {
  validationError(() =>
    parseEmailMessageInput({
      action: "save-draft",
      to: "buyer@example.com",
      subject: "x".repeat(501),
      body: "Draft",
    }),
  );
  validationError(() =>
    parseEmailMessageInput({
      action: "save-draft",
      to: "buyer@example.com",
      subject: "Quote",
      body: "Draft",
      attachments: [
        {
          name: "oversized.pdf",
          type: "application/pdf",
          size: MAX_EMAIL_ATTACHMENT_BYTES + 1,
        },
      ],
    }),
  );

  const parsed = parseEmailMessageInput({
    action: "save-draft",
    to: " BUYER@Example.COM ",
    subject: " Quote ",
    body: "Draft",
    attachments: [
      {
        name: "quote.pdf",
        type: "application/pdf",
        size: MAX_EMAIL_ATTACHMENT_BYTES,
      },
    ],
  });
  assert.equal(parsed.to[0].email, "buyer@example.com");
  assert.equal(parsed.attachments[0].sizeBytes, MAX_EMAIL_ATTACHMENT_BYTES);
});

test("account credentials are sealed with tenant and account AAD", async () => {
  const repository = createMemoryEmailRepository();
  const key = new Uint8Array(32).fill(7);
  const companyId = "10000000-0000-4000-8000-000000000001";
  const created = await createEmailAccount(
    repository,
    { companyId, userId: "10000000-0000-4000-8000-000000000002" },
    smtpAccount,
    key,
  );
  const stored = (await repository.listAccounts(companyId))[0];

  assert.equal("encryptedCredentials" in created, false);
  assert.equal(stored.encryptedCredentials?.includes("application-password"), false);
  assert.deepEqual(
    await openEmailAccountCredentials(stored, key),
    {
      username: "sales@example.com",
      password: "application-password",
    },
  );
  await assert.rejects(
    () =>
      openEmailAccountCredentials(
        { ...stored, companyId: "10000000-0000-4000-8000-000000000003" },
        key,
      ),
    (error: unknown) =>
      error instanceof BusinessError &&
      error.code === "CREDENTIALS_DECRYPT_FAILED",
  );
});

test("local demo mode saves drafts but reports unconfigured sending", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const draftResponse = await submitEmail(
      businessRequest("http://localhost/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-draft",
          to: "buyer@example.com",
          subject: "Draft quote",
          body: "Draft",
        }),
      }),
    );
    assert.equal(draftResponse.status, 200);
    assert.equal((await draftResponse.json()).email.folder, "draft");

    const sendResponse = await submitEmail(
      businessRequest("http://localhost/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          to: "buyer@example.com",
          subject: "Send quote",
          body: "Ready",
        }),
      }),
    );
    assert.equal(sendResponse.status, 503);
    assert.equal((await sendResponse.json()).code, "PROVIDER_NOT_CONFIGURED");
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

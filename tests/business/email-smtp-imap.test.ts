import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryEmailRepository } from "../../src/lib/email/repository";
import { syncImapAccount } from "../../src/lib/email/providers/imap";
import { ProviderSendError } from "../../src/lib/email/providers/contracts";
import { SmtpEmailProvider } from "../../src/lib/email/providers/smtp";
import type { EmailAccount } from "../../src/lib/email/types";

const COMPANY_ID = "10000000-0000-4000-8000-000000000201";
const ACCOUNT_ID = "10000000-0000-4000-8000-000000000202";

function account(): EmailAccount {
  const now = new Date(0).toISOString();
  return {
    id: ACCOUNT_ID,
    companyId: COMPANY_ID,
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
    encryptedCredentials: "sealed",
    credentialsConfigured: true,
    status: "active",
    healthStatus: "unknown",
    lastError: null,
    syncCursor: {},
    createdAt: now,
    updatedAt: now,
  };
}

function rawMessage(uid: number) {
  return Buffer.from(`From: buyer${uid}@example.com\r\nTo: sales@example.com\r\nSubject: Message ${uid}\r\nMessage-ID: <imap-${uid}@example.com>\r\n\r\nBody ${uid}`);
}

test("SMTP provider sends with configured transport options and always closes", async () => {
  let closed = false;
  let transportOptions: Record<string, unknown> | undefined;
  let mail: Record<string, unknown> | undefined;
  const provider = new SmtpEmailProvider({
    host: "smtp.example.com",
    port: 465,
    secure: true,
    username: "sales@example.com",
    password: "secret",
    transportFactory: ((options: Record<string, unknown>) => {
      transportOptions = options;
      return {
        sendMail: async (input: Record<string, unknown>) => {
          mail = input;
          return { messageId: "smtp-message-1" };
        },
        close: () => { closed = true; },
      };
    }) as never,
  });

  const result = await provider.send({ from: "sales@example.com", to: "buyer@example.com", subject: "Quote", text: "Hello", html: "<p>Hello</p>", idempotencyKey: "smtp-key" });

  assert.equal(result.externalId, "smtp-message-1");
  assert.equal(transportOptions?.host, "smtp.example.com");
  assert.deepEqual(transportOptions?.auth, { user: "sales@example.com", pass: "secret" });
  assert.deepEqual(mail?.headers, { "X-TradePilot-Idempotency-Key": "smtp-key" });
  assert.equal(closed, true);
});

test("SMTP message rejection is permanent but is not reported as authentication failure", async () => {
  let closed = false;
  const provider = new SmtpEmailProvider({
    host: "smtp.example.com",
    port: 465,
    secure: true,
    username: "sales@example.com",
    password: "secret",
    transportFactory: (() => ({
      sendMail: async () => { throw Object.assign(new Error("recipient rejected"), { code: "EENVELOPE" }); },
      close: () => { closed = true; },
    })) as never,
  });

  await assert.rejects(
    provider.send({ from: "sales@example.com", to: "invalid@example.com", subject: "Quote", text: "Hello", html: "" }),
    (error: unknown) => {
      assert.equal(error instanceof ProviderSendError, true);
      assert.equal((error as ProviderSendError).code, "PROVIDER_INVALID_REQUEST");
      assert.equal((error as ProviderSendError).retryable, false);
      return true;
    },
  );
  assert.equal(closed, true);
});

test("IMAP sync imports new UIDs, advances the cursor, and releases resources", async () => {
  const repository = createMemoryEmailRepository();
  const emailAccount = await repository.createAccount(account());
  let released = false;
  let loggedOut = false;
  let fetchedRange = "";
  const client = {
    mailbox: { uidValidity: 42 },
    connect: async () => {},
    getMailboxLock: async (mailbox: string) => {
      assert.equal(mailbox, "INBOX");
      return { release: () => { released = true; } };
    },
    fetch: async function* (range: string) {
      fetchedRange = range;
      yield { uid: 1, source: rawMessage(1) };
      yield { uid: 2, source: rawMessage(2) };
    },
    logout: async () => { loggedOut = true; },
  };

  const result = await syncImapAccount({ account: emailAccount, credentials: { username: "sales@example.com", password: "secret" }, repository, clientFactory: (() => client) as never });

  assert.deepEqual(result, { inserted: 2, uidValidity: "42", lastUid: 2 });
  assert.equal(fetchedRange, "1:*");
  assert.equal(released, true);
  assert.equal(loggedOut, true);
  assert.equal((await repository.listMessages(COMPANY_ID, { accountId: ACCOUNT_ID })).length, 2);
  const stored = (await repository.listAccounts(COMPANY_ID))[0];
  assert.equal(stored?.healthStatus, "healthy");
  assert.equal(stored?.syncCursor.lastUid, 2);
  assert.equal(stored?.syncCursor.uidValidity, "42");
});

test("IMAP sync records a safe health error and releases the mailbox lock", async () => {
  const repository = createMemoryEmailRepository();
  const emailAccount = await repository.createAccount(account());
  let released = false;
  let loggedOut = false;
  const client = {
    mailbox: { uidValidity: 42 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => { released = true; } }),
    fetch: async function* () { throw new Error("secret connection details"); },
    logout: async () => { loggedOut = true; },
  };

  await assert.rejects(
    syncImapAccount({ account: emailAccount, credentials: { username: "sales@example.com", password: "secret" }, repository, clientFactory: (() => client) as never }),
    /IMAP synchronization failed/,
  );

  const stored = (await repository.listAccounts(COMPANY_ID))[0];
  assert.equal(stored?.healthStatus, "error");
  assert.equal(stored?.lastError, "IMAP synchronization failed");
  assert.equal(released, true);
  assert.equal(loggedOut, true);
});

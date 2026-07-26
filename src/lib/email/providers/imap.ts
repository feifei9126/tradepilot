import { ImapFlow } from "imapflow";
import type { EmailAccount, EmailRepository } from "../types";
import { normalizeInboundEmail } from "../inbound";

export interface ImapSyncOptions { account: EmailAccount; credentials: Record<string, string>; repository: EmailRepository; clientFactory?: (config: ConstructorParameters<typeof ImapFlow>[0]) => ImapFlow; maxMessages?: number; }

function cursor(account: EmailAccount) {
  const value = account.syncCursor || {};
  return { uidValidity: typeof value.uidValidity === "string" ? value.uidValidity : "", lastUid: typeof value.lastUid === "number" && Number.isSafeInteger(value.lastUid) ? value.lastUid : 0 };
}

export async function syncImapAccount(options: ImapSyncOptions) {
  const { account, credentials, repository } = options;
  if (!account.imapHost || !account.imapPort || !credentials.username || !credentials.password) throw new Error("IMAP account is incomplete");
  const client = (options.clientFactory || ((config) => new ImapFlow(config)))({ host: account.imapHost, port: account.imapPort, secure: account.imapSecure, auth: { user: credentials.username, pass: credentials.password }, logger: false });
  const previous = cursor(account);
  let inserted = 0;
  let lastUid = previous.lastUid;
  let uidValidity = previous.uidValidity;
  try {
    await client.connect();
    const lock = await client.getMailboxLock(account.imapMailbox || "INBOX");
    try {
      uidValidity = String(client.mailbox && "uidValidity" in client.mailbox ? client.mailbox.uidValidity : previous.uidValidity || "");
      if (previous.uidValidity && uidValidity && previous.uidValidity !== uidValidity) lastUid = 0;
      const range = `${lastUid + 1}:*`;
      for await (const message of client.fetch(range, { uid: true, source: true }, { uid: true })) {
        if (!message.source || message.uid <= lastUid) continue;
        const normalized = await normalizeInboundEmail({ companyId: account.companyId, accountId: account.id, provider: "imap", providerMessageId: `imap:${uidValidity}:${message.uid}`, rawMime: message.source });
        await repository.insertInboundMessage(normalized);
        lastUid = Math.max(lastUid, message.uid);
        inserted += 1;
        if (inserted >= (options.maxMessages || 100)) break;
      }
    } finally { lock.release(); }
    await repository.updateAccount(account.companyId, account.id, { syncCursor: { uidValidity, lastUid, updatedAt: new Date().toISOString() }, healthStatus: "healthy", lastError: null });
    return { inserted, uidValidity, lastUid };
  } catch {
    await repository.updateAccount(account.companyId, account.id, { healthStatus: "error", lastError: "IMAP synchronization failed" });
    throw new Error("IMAP synchronization failed");
  } finally { try { await client.logout(); } catch {} }
}

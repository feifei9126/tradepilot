import { resolveMailEndpoint } from "./network-policy";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { query } from "@/db";
import type { StoredEmail } from "@/lib/store";
import { CrmRepository } from "@/lib/crm-repository";
import { getEmailAccount, getEmailCredentials } from "./credentials";
import { BillingError } from "@/lib/billing";

function readable(value: unknown) { return typeof value === "string" ? value : ""; }
function addressText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) return value.map(addressText).filter(Boolean).join(", ");
  const item = value as { text?: unknown; value?: unknown };
  if (typeof item.text === "string") return item.text;
  if (Array.isArray(item.value)) {
    return item.value.map((entry: unknown) => {
      if (!entry || typeof entry !== "object") return "";
      const address = entry as { address?: unknown; name?: unknown };
      const email = typeof address.address === "string" ? address.address : "";
      const name = typeof address.name === "string" ? address.name : "";
      return name && email ? `"${name.replace(/["\r\n]+/g, " ").trim()}" <${email}>` : email || name;
    }).filter(Boolean).join(", ");
  }
  return "";
}
function safeDate(value: Date | undefined) {
  return value && !Number.isNaN(value.getTime()) ? value.toISOString() : new Date().toISOString();
}
async function imapClient(account: { imapHost: string; imapPort: number; imapSecure: boolean }, credentials: { imapUsername: string; imapPassword: string }) {
  if (!credentials.imapUsername || !credentials.imapPassword) throw new BillingError("该邮箱尚未配置 IMAP 用户名和密码", 503, "IMAP_NOT_CONFIGURED");
  const target = await resolveMailEndpoint({ host: account.imapHost, port: account.imapPort, secure: account.imapSecure, protocol: "imap" });
  return new ImapFlow({ host: target.address, port: account.imapPort, secure: account.imapSecure, servername: target.servername, doSTARTTLS: !account.imapSecure, auth: { user: credentials.imapUsername, pass: credentials.imapPassword }, logger: false, tls: { rejectUnauthorized: true, minVersion: "TLSv1.2", servername: target.servername }, socketTimeout: 20_000, connectionTimeout: 10_000 });
}

export async function testImapConnection(companyId: string, accountId: string) {
  const account = await getEmailAccount(companyId, accountId); const credentials = await getEmailCredentials(companyId, accountId);
  if (!account || !credentials) throw new BillingError("邮箱账号或 IMAP 凭据不存在", 404, "IMAP_ACCOUNT_NOT_FOUND");
  const client = await imapClient(account, credentials);
  await client.connect(); try { await client.list(); } finally { await client.logout().catch(() => {}); }
}

export async function syncTenantMailbox(companyId: string, accountId: string, folder = "INBOX", limit = 50) {
  const account = await getEmailAccount(companyId, accountId); const credentials = await getEmailCredentials(companyId, accountId);
  if (!account || !credentials) throw new BillingError("邮箱账号或 IMAP 凭据不存在", 404, "IMAP_ACCOUNT_NOT_FOUND");
  const normalizedFolder = folder.trim().slice(0, 100) || "INBOX";
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const stateResult = await query("SELECT uid_validity,last_uid FROM email_sync_state WHERE company_id=$1 AND account_id=$2 AND folder=$3", [companyId, accountId, normalizedFolder]);
  const state = stateResult.rows[0];
  let highestUid = Number(state?.last_uid || 0);
  let uidValidity: string | null = state?.uid_validity ? String(state.uid_validity) : null;
  const client = await imapClient(account, credentials);
  let imported = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock(normalizedFolder);
    try {
      const mailbox = client.mailbox && typeof client.mailbox === "object" ? client.mailbox : null;
      const currentUidValidity = mailbox?.uidValidity ? String(mailbox.uidValidity) : null;
      if (uidValidity && currentUidValidity && uidValidity !== currentUidValidity) highestUid = 0;
      uidValidity = currentUidValidity || uidValidity;
      const range = highestUid > 0 ? `${highestUid + 1}:*` : "1:*";
      for await (const message of client.fetch(range, { uid: true, envelope: true, source: true, flags: true }, { uid: true })) {
        if (imported >= safeLimit) break;
        const uid = Number(message.uid); if (!uid || uid <= highestUid) continue;
        highestUid = Math.max(highestUid, uid);
        if (!message.source) continue;
        const source = Buffer.isBuffer(message.source) ? message.source : Buffer.from(message.source);
        const parsed = await simpleParser(source, { maxHtmlLengthToParse: 200_000 });
        const id = `imap-${accountId}-${uid}`;
        const existing = await new CrmRepository(companyId, "system").emails.get(id);
        if (existing) continue;
        const email: StoredEmail = {
          id, accountId, messageId: readable(parsed.messageId) || id, from: addressText(parsed.from), to: addressText(parsed.to),
          subject: readable(parsed.subject).slice(0, 500), body: readable(parsed.text).slice(0, 100_000), htmlBody: typeof parsed.html === "string" ? parsed.html.slice(0, 200_000) : undefined,
          date: safeDate(parsed.date), folder: normalizedFolder.toLowerCase() === "sent" ? "sent" : "inbox", isRead: Boolean(message.flags?.has("\\Seen")), isStarred: Boolean(message.flags?.has("\\Flagged")), labels: ["IMAP 同步"], createdAt: new Date().toISOString(),
        };
        await new CrmRepository(companyId, "system").emails.add(email); imported += 1;
      }
    } finally { lock.release(); }
  } catch (error) {
    const message = error instanceof BillingError ? error.message : "IMAP 同步失败，请检查服务器、文件夹和凭据";
    await query(`INSERT INTO email_sync_state(company_id,account_id,folder,uid_validity,last_uid,last_synced_at,sync_error) VALUES($1,$2,$3,$4,$5,NULL,$6)
      ON CONFLICT(company_id,account_id,folder) DO UPDATE SET uid_validity=EXCLUDED.uid_validity,last_uid=EXCLUDED.last_uid,sync_error=EXCLUDED.sync_error`, [companyId, accountId, normalizedFolder, uidValidity, highestUid, message.slice(0, 255)]).catch(() => {});
    if (error instanceof BillingError) throw error;
    throw new BillingError(message, 502, "IMAP_SYNC_FAILED");
  } finally { await client.logout().catch(() => {}); }
  await query(`INSERT INTO email_sync_state(company_id,account_id,folder,uid_validity,last_uid,last_synced_at,sync_error) VALUES($1,$2,$3,$4,$5,now(),NULL)
    ON CONFLICT(company_id,account_id,folder) DO UPDATE SET uid_validity=EXCLUDED.uid_validity,last_uid=EXCLUDED.last_uid,last_synced_at=now(),sync_error=NULL`, [companyId, accountId, normalizedFolder, uidValidity, highestUid]);
  await query("UPDATE crm_records SET data=jsonb_set(data,'{lastSyncAt}',to_jsonb(now()::text),true),updated_at=now() WHERE company_id=$1 AND kind='email_accounts' AND id=$2", [companyId, accountId]);
  return { imported, lastUid: highestUid, folder: normalizedFolder };
}

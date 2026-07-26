import { createHash } from "node:crypto";
import http from "node:http";
import { ImapFlow } from "imapflow";
import PostalMime from "postal-mime";
import sanitizeHtml from "sanitize-html";
import nodemailer from "tradepilot-nodemailer";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL?.trim();
const credentialsKey = process.env.TRADEPILOT_CREDENTIALS_KEY?.trim();
if (!databaseUrl || !credentialsKey) {
  console.error("DATABASE_URL and TRADEPILOT_CREDENTIALS_KEY are required");
  process.exit(1);
}

const intervalMs = Math.max(5000, Number(process.env.MAIL_WORKER_INTERVAL_MS || 30000));
const port = Number(process.env.MAIL_WORKER_HEALTH_PORT || 8790);
const sql = postgres(databaseUrl, { max: 3, prepare: false });
let stopping = false;
let running = null;
let lastRunAt = null;
let failureCount = 0;

function base64url(value) { return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64"); }
async function decryptCredentials(account) {
  const envelope = JSON.parse(account.encrypted_credentials || "null");
  const key = base64url(credentialsKey);
  if (!envelope || envelope.version !== "v1" || key.length !== 32) throw new Error("credential envelope is invalid");
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
  const aad = new TextEncoder().encode(JSON.stringify({ companyId: account.company_id, purpose: "email", recordId: account.id }));
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64url(envelope.iv), additionalData: aad, tagLength: 128 }, cryptoKey, base64url(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function leaseOutbox() {
  return sql.begin(async (transaction) => transaction`
    WITH candidates AS (
      SELECT outbox.id FROM email_outbox AS outbox
      INNER JOIN email_accounts AS account
        ON account.company_id=outbox.company_id AND account.id=outbox.account_id
      WHERE account.provider='smtp_imap' AND account.status='active'
        AND outbox.status IN ('pending','retry','leased')
        AND outbox.next_attempt_at <= now()
        AND (outbox.leased_until IS NULL OR outbox.leased_until <= now())
      ORDER BY outbox.next_attempt_at
      FOR UPDATE OF outbox SKIP LOCKED
      LIMIT 50
    )
    UPDATE email_outbox AS outbox
    SET status='leased', leased_until=now()+interval '5 minutes', updated_at=now()
    FROM candidates WHERE outbox.id=candidates.id RETURNING outbox.*
  `);
}

function outboundAddresses(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.filter((entry) => typeof entry === "string" && entry.trim()).map((email) => ({ email: email.trim().toLowerCase() }));
}

async function processOutbox() {
  const rows = await leaseOutbox();
  for (const item of rows) {
    let credentials = {};
    try {
      const [account] = await sql`SELECT * FROM email_accounts WHERE company_id=${item.company_id} AND id=${item.account_id} AND status='active'`;
      if (!account) throw new Error("email account is unavailable");
      credentials = await decryptCredentials(account);
      if (account.provider !== "smtp_imap") throw new Error("mail worker only handles SMTP accounts");
      const transport = nodemailer.createTransport({ host: account.smtp_host, port: account.smtp_port, secure: account.smtp_secure, auth: { user: credentials.username, pass: credentials.password }, pool: false, connectionTimeout: 15000, socketTimeout: 30000 });
      const payload = item.payload || {};
      let result;
      try {
        result = await transport.sendMail({ from: payload.from || account.email, to: payload.to, cc: payload.cc, bcc: payload.bcc, replyTo: payload.replyTo, subject: payload.subject, text: payload.text, html: payload.html || undefined, headers: { "X-TradePilot-Idempotency-Key": item.idempotency_key } });
      } finally {
        transport.close();
      }
      const externalId = String(result.messageId || "");
      const threadId = typeof payload.threadId === "string" && /^[0-9a-f-]{36}$/i.test(payload.threadId) ? payload.threadId : item.id;
      const sentAt = new Date();
      const from = outboundAddresses(payload.from || account.email);
      const to = outboundAddresses(payload.to);
      await sql.begin(async (transaction) => {
        await transaction`INSERT INTO email_threads (id,company_id,account_id,subject,participants,message_count,last_message_at) VALUES (${threadId},${item.company_id},${item.account_id},${String(payload.subject || "").slice(0,500)},${transaction.json([...from,...to])},0,${sentAt}) ON CONFLICT (id) DO NOTHING`;
        const inserted = await transaction`INSERT INTO email_messages (company_id,account_id,thread_id,normalized_message_key,external_id,direction,folder,from_addresses,to_addresses,cc_addresses,bcc_addresses,subject,text_body,html_body,is_read,status,sent_at) VALUES (${item.company_id},${item.account_id},${threadId},${`outbox:${item.id}`},${externalId},'outbound','sent',${transaction.json(from)},${transaction.json(to)},${transaction.json(outboundAddresses(payload.cc))},${transaction.json(outboundAddresses(payload.bcc))},${String(payload.subject || "").slice(0,500)},${typeof payload.text === "string" ? payload.text : null},${typeof payload.html === "string" ? payload.html : null},true,'sent',${sentAt}) ON CONFLICT (account_id,normalized_message_key) DO NOTHING RETURNING id`;
        if (inserted.length) await transaction`UPDATE email_threads SET message_count=message_count+1,last_message_at=${sentAt},updated_at=now() WHERE company_id=${item.company_id} AND id=${threadId} AND account_id=${item.account_id}`;
        await transaction`UPDATE email_outbox SET status='sent', external_id=${externalId}, leased_until=NULL, last_error=NULL, last_error_code=NULL, updated_at=now() WHERE company_id=${item.company_id} AND id=${item.id}`;
      });
    } catch {
      const attempt = item.attempt_count + 1;
      const retry = attempt < 8;
      const delays = [30,120,600,1800,7200,43200,86400];
      const delay = delays[Math.min(attempt - 1, delays.length - 1)];
      await sql`UPDATE email_outbox SET status=${retry ? "retry" : "failed"}, attempt_count=${attempt}, next_attempt_at=CASE WHEN ${retry} THEN now()+(${delay}*interval '1 second') ELSE next_attempt_at END, leased_until=NULL, last_error_code='SMTP_DELIVERY_FAILED', last_error='SMTP delivery failed', updated_at=now() WHERE company_id=${item.company_id} AND id=${item.id}`;
      failureCount += 1;
    } finally {
      for (const key of Object.keys(credentials)) credentials[key] = "";
    }
  }
}

function stableUuid(value) {
  const bytes = createHash("sha256").update(value).digest();
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

function addresses(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap((entry) => entry?.address ? [{ email: String(entry.address).toLowerCase(), ...(entry.name ? { name: String(entry.name) } : {}) }] : entry?.group ? addresses(entry.group) : []);
}

async function storeImapMessage(account, parsed, uidValidity, uid) {
  const messageKey = `imap:${uidValidity}:${uid}`;
  const threadId = stableUuid(`${account.company_id}:${account.id}:${messageKey}`);
  const from = addresses(parsed.from);
  const to = addresses(parsed.to);
  const receivedAt = parsed.date && !Number.isNaN(Date.parse(parsed.date)) ? new Date(parsed.date) : new Date();
  await sql.begin(async (transaction) => {
    await transaction`INSERT INTO email_threads (id,company_id,account_id,subject,participants,message_count,last_message_at) VALUES (${threadId},${account.company_id},${account.id},${String(parsed.subject || "").slice(0,500)},${transaction.json([...from,...to])},0,${receivedAt}) ON CONFLICT (id) DO NOTHING`;
    const inserted = await transaction`INSERT INTO email_messages (company_id,account_id,thread_id,normalized_message_key,provider_message_id,direction,folder,from_addresses,to_addresses,cc_addresses,bcc_addresses,subject,text_body,html_body,received_at) VALUES (${account.company_id},${account.id},${threadId},${messageKey},${parsed.messageId || null},'inbound','inbox',${transaction.json(from)},${transaction.json(to)},${transaction.json(addresses(parsed.cc))},${transaction.json(addresses(parsed.bcc))},${String(parsed.subject || "").slice(0,500)},${parsed.text || null},${parsed.html ? sanitizeHtml(parsed.html) : null},${receivedAt}) ON CONFLICT (account_id,normalized_message_key) DO NOTHING RETURNING id`;
    if (inserted.length) await transaction`UPDATE email_threads SET message_count=message_count+1,last_message_at=${receivedAt},updated_at=now() WHERE company_id=${account.company_id} AND id=${threadId} AND account_id=${account.id}`;
  });
}

async function syncAccount(account) {
  let credentials = {};
  let client;
  const previous = account.sync_cursor || {};
  let lastUid = Number.isSafeInteger(previous.lastUid) ? previous.lastUid : 0;
  let uidValidity = String(previous.uidValidity || "");
  try {
    credentials = await decryptCredentials(account);
    client = new ImapFlow({ host: account.imap_host, port: account.imap_port, secure: account.imap_secure, auth: { user: credentials.username, pass: credentials.password }, logger: false });
    await client.connect();
    const lock = await client.getMailboxLock(account.imap_mailbox || "INBOX");
    try {
      const currentValidity = String(client.mailbox?.uidValidity || "");
      if (uidValidity && currentValidity && uidValidity !== currentValidity) lastUid = 0;
      uidValidity = currentValidity;
      for await (const message of client.fetch(`${lastUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (!message.source || message.uid <= lastUid) continue;
        await storeImapMessage(account, await PostalMime.parse(message.source), uidValidity, message.uid);
        lastUid = message.uid;
      }
    } finally { lock.release(); }
    await sql`UPDATE email_accounts SET sync_cursor=${sql.json({ uidValidity, lastUid, updatedAt: new Date().toISOString() })},health_status='healthy',last_error=NULL,updated_at=now() WHERE company_id=${account.company_id} AND id=${account.id}`;
  } catch {
    failureCount += 1;
    await sql`UPDATE email_accounts SET health_status='error',last_error='IMAP synchronization failed',updated_at=now() WHERE company_id=${account.company_id} AND id=${account.id}`;
  } finally {
    if (client) try { await client.logout(); } catch {}
    for (const key of Object.keys(credentials)) credentials[key] = "";
  }
}

async function runOnce() {
  await sql`SELECT 1`;
  await processOutbox();
  const accounts = await sql`SELECT * FROM email_accounts WHERE provider='smtp_imap' AND status='active' ORDER BY company_id,id`;
  for (const account of accounts) await syncAccount(account);
  lastRunAt = new Date().toISOString();
}

async function loop() {
  while (!stopping) {
    running = runOnce().catch(() => { failureCount += 1; }).finally(() => { running = null; });
    await running;
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

const server = http.createServer(async (request, response) => {
  if (request.url !== "/health") { response.writeHead(404).end(); return; }
  try { await sql`SELECT 1`; response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok", database: true, lastRunAt, failureCount })); } catch { response.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "error", database: false, lastRunAt, failureCount })); }
});

async function shutdown() { stopping = true; if (running) await running; server.close(); await sql.end({ timeout: 5 }); }
process.on("SIGTERM", () => { void shutdown(); });
process.on("SIGINT", () => { void shutdown(); });
server.listen(port, "0.0.0.0", () => { void loop(); });

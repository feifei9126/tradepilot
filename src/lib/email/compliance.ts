import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { query, transaction } from "@/db";
import { BillingError } from "@/lib/billing";

function secret() {
  const value = process.env.TRADEPILOT_CONFIG_KEY?.trim() || process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
  if (value.length < 32) throw new Error("退订链接签名需要至少 32 字符的 TRADEPILOT_CONFIG_KEY 或 AUTH_SECRET");
  return value;
}
function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function policyVersion() { return process.env.MARKETING_POLICY_VERSION?.trim().slice(0, 40) || "2026-10-07"; }

export function createUnsubscribeToken(companyId: string, email: string, ttlSeconds = 90 * 24 * 3600) {
  const payload = { v: 1, companyId, email: normalizeEmail(email), exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}

export function verifyUnsubscribeToken(token: string) {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) throw new BillingError("退订链接无效", 400, "UNSUBSCRIBE_TOKEN_INVALID");
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BillingError("退订链接无效", 400, "UNSUBSCRIBE_TOKEN_INVALID");
  let payload: unknown;
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { throw new BillingError("退订链接无效", 400, "UNSUBSCRIBE_TOKEN_INVALID"); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new BillingError("退订链接无效", 400, "UNSUBSCRIBE_TOKEN_INVALID");
  const item = payload as Record<string, unknown>;
  if (item.v !== 1 || typeof item.companyId !== "string" || !/^[0-9a-f-]{36}$/i.test(item.companyId) || typeof item.email !== "string" || !item.email.includes("@") || typeof item.exp !== "number") throw new BillingError("退订链接无效", 400, "UNSUBSCRIBE_TOKEN_INVALID");
  if (item.exp < Date.now() / 1000) throw new BillingError("退订链接已失效", 410, "UNSUBSCRIBE_TOKEN_EXPIRED");
  return { companyId: item.companyId, email: normalizeEmail(item.email) };
}

export function buildUnsubscribeUrl(companyId: string, email: string) {
  const base = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!base) return undefined;
  let url: URL;
  try { url = new URL("/api/email/unsubscribe", base); } catch { return undefined; }
  url.searchParams.set("token", createUnsubscribeToken(companyId, email));
  return url.toString();
}

export async function isSuppressed(companyId: string, email: string) {
  const result = await query("SELECT 1 FROM email_suppressions WHERE company_id=$1 AND email=$2 AND resubscribed_at IS NULL", [companyId, normalizeEmail(email)]);
  return Boolean(result.rowCount);
}

export async function setSuppression(companyId: string, email: string, input: { reason?: string; source?: string; ip?: string; userAgent?: string; resubscribe?: boolean }) {
  if (input.resubscribe) throw new BillingError("重新订阅必须由收件人确认，不能由工作区成员直接恢复", 409, "RECIPIENT_CONFIRMATION_REQUIRED");
  const normalized = normalizeEmail(email);
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`consent:${companyId}:${normalized}`]);
    await client.query(`INSERT INTO email_suppressions(company_id,email,reason,source,resubscribed_at) VALUES($1,$2,$3,$4,NULL)
      ON CONFLICT(company_id,email) DO UPDATE SET reason=EXCLUDED.reason,source=EXCLUDED.source,unsubscribed_at=now(),resubscribed_at=NULL`, [companyId,normalized,input.reason || "unsubscribe",input.source || "user"]);
    await client.query(`INSERT INTO email_marketing_consents(company_id,email,status,source,policy_version,unsubscribed_at)
      VALUES($1,$2,'unsubscribed',$3,$4,now()) ON CONFLICT(company_id,email) DO UPDATE SET status='unsubscribed',source=EXCLUDED.source,policy_version=EXCLUDED.policy_version,unsubscribed_at=now(),confirmed_at=NULL,updated_at=now()`, [companyId,normalized,input.source || "user",policyVersion()]);
    await client.query("UPDATE email_consent_challenges SET invalidated_at=now() WHERE company_id=$1 AND email=$2 AND confirmed_at IS NULL", [companyId,normalized]);
    await client.query(`INSERT INTO email_consent_events(id,company_id,email,event,source,policy_version,ip_hash,user_agent_hash) VALUES($1,$2,$3,'unsubscribed',$4,$5,$6,$7)`, [randomUUID(),companyId,normalized,input.source || "user",policyVersion(),input.ip ? hash(input.ip) : null,input.userAgent ? hash(input.userAgent) : null]);
  });
}

export async function recordMarketingConsent(companyId: string, email: string, input: { subscribed: boolean; source?: string; ip?: string; userAgent?: string }) {
  if (input.subscribed) throw new BillingError("请让收件人打开公开订阅页面并通过邮件确认；管理员不能代为订阅", 409, "RECIPIENT_CONFIRMATION_REQUIRED");
  await setSuppression(companyId,email,{ ...input,reason:"consent" });
}

/** Tokens are random, single-use, hashed at rest, scoped to tenant/email and
 * delivered only to that recipient. A later unsubscribe invalidates old links. */
export async function confirmMarketingConsent(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new BillingError("订阅确认链接无效",400,"CONSENT_TOKEN_INVALID");
  return transaction(async client => {
    const identity = (await client.query("SELECT company_id,email FROM email_consent_challenges WHERE token_hash=$1", [hash(token)])).rows[0];
    if (!identity) throw new BillingError("订阅确认链接无效或已使用",410,"CONSENT_TOKEN_EXPIRED");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`consent:${identity.company_id}:${identity.email}`]);
    const challenge = (await client.query("SELECT * FROM email_consent_challenges WHERE token_hash=$1 AND confirmed_at IS NULL AND invalidated_at IS NULL AND expires_at > clock_timestamp() FOR UPDATE",[hash(token)])).rows[0];
    if (!challenge) throw new BillingError("订阅确认链接无效、已使用或已过期",410,"CONSENT_TOKEN_EXPIRED");
    const active = await client.query("SELECT id FROM companies WHERE id=$1 AND is_active=true",[identity.company_id]);
    if (!active.rowCount) throw new BillingError("工作区不可用",403,"WORKSPACE_UNAVAILABLE");
    await client.query("UPDATE email_consent_challenges SET confirmed_at=now() WHERE token_hash=$1",[hash(token)]);
    await client.query("UPDATE email_suppressions SET resubscribed_at=now() WHERE company_id=$1 AND email=$2",[identity.company_id,identity.email]);
    await client.query(`INSERT INTO email_marketing_consents(company_id,email,status,source,policy_version,subscribed_at,confirmed_at)
      VALUES($1,$2,'subscribed','recipient-double-opt-in',$3,now(),now()) ON CONFLICT(company_id,email) DO UPDATE SET status='subscribed',source=EXCLUDED.source,policy_version=EXCLUDED.policy_version,subscribed_at=now(),confirmed_at=now(),unsubscribed_at=NULL,updated_at=now()`,[identity.company_id,identity.email,policyVersion()]);
    await client.query("INSERT INTO email_consent_events(id,company_id,email,event,source,policy_version) VALUES($1,$2,$3,'resubscribed','recipient-double-opt-in',$4)",[randomUUID(),identity.company_id,identity.email,policyVersion()]);
    return { ok:true };
  });
}

export async function assertMarketingRecipientsAllowed(companyId: string, emails: string[]) {
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (!normalized.length) throw new BillingError("请填写至少一个收件人", 400, "EMAIL_RECIPIENT_REQUIRED");
  const result = await query("SELECT email FROM email_suppressions WHERE company_id=$1 AND email=ANY($2::text[]) AND resubscribed_at IS NULL", [companyId, normalized]);
  if (result.rowCount) throw new BillingError(`收件人已退订，营销邮件已拦截（${result.rows.map(row => row.email).join("、")}）`, 409, "EMAIL_SUPPRESSED");
  // No client or tenant-configurable exemption.
  const consent = await query("SELECT email FROM email_marketing_consents WHERE company_id=$1 AND email=ANY($2::text[]) AND status='subscribed' AND confirmed_at IS NOT NULL", [companyId, normalized]);
  const subscribed = new Set(consent.rows.map(row => String(row.email)));
  const missing = normalized.filter(email => !subscribed.has(email));
  if (missing.length) throw new BillingError(`营销邮件需要收件人明确订阅（未订阅：${missing.join("、")}）`, 409, "EMAIL_CONSENT_REQUIRED");
}

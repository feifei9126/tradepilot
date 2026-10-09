import { createHash, randomBytes } from "node:crypto";
import { transaction, query } from "@/db";
import { BillingError } from "@/lib/billing";
import { takeDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { sendConsentConfirmation } from "./smtp";

function publicOrigin() {
  const base = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost");
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:") throw new BillingError("公开订阅确认必须配置 HTTPS AUTH_URL",503,"CONSENT_HTTPS_REQUIRED");
  return base;
}

/** Public entry point, NOT the secret proof-of-ownership confirmation link. */
export function marketingSubscriptionUrl(companyId: string) {
  const url = new URL("/api/email/subscribe", publicOrigin());
  url.searchParams.set("workspace", companyId);
  return url.toString();
}

export async function requestMarketingOptIn(companyId: string, email: string, deliver = sendConsentConfirmation) {
  email = email.trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(companyId) || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BillingError("工作区或邮箱格式无效",400,"CONSENT_INPUT_INVALID");
  const base = publicOrigin();
  const throttle = await takeDistributedRateLimit("consent-request-recipient",`${companyId}:${email}`,2,86400);
  const tenantThrottle = await takeDistributedRateLimit("consent-request-tenant",companyId,100,86400);
  if (!throttle.allowed || !tenantThrottle.allowed) throw new BillingError("申请过于频繁，请稍后再试",429,"CONSENT_RATE_LIMITED");
  const token = randomBytes(32).toString("hex"), tokenHash = createHash("sha256").update(token).digest("hex");
  const accountId = await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`consent:${companyId}:${email}`]);
    const account = (await client.query(`SELECT r.id FROM crm_records r JOIN email_account_secrets s ON s.company_id=r.company_id AND s.account_id=r.id
      JOIN companies c ON c.id=r.company_id WHERE r.company_id=$1 AND r.kind='email_accounts' AND c.is_active=true AND s.smtp_password_ciphertext IS NOT NULL ORDER BY r.id LIMIT 1`,[companyId])).rows[0];
    if (!account) throw new BillingError("该工作区尚未配置订阅确认邮箱",503,"CONSENT_SMTP_NOT_CONFIGURED");
    await client.query("UPDATE email_consent_challenges SET invalidated_at=now() WHERE company_id=$1 AND email=$2 AND confirmed_at IS NULL",[companyId,email]);
    await client.query("INSERT INTO email_consent_challenges(token_hash,company_id,email,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",[tokenHash,companyId,email]);
    return String(account.id);
  });
  const url = new URL("/api/email/subscribe",base); url.searchParams.set("token",token);
  try { await deliver(companyId,accountId,email,url.toString()); }
  catch (error) { await query("UPDATE email_consent_challenges SET invalidated_at=now() WHERE token_hash=$1",[tokenHash]).catch(() => {}); throw error; }
  // Never return the token or link to a tenant member/API caller.
  return { ok:true,message:"确认邮件已发送；请由收件人点击链接并确认后完成订阅" };
}

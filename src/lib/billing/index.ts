import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { getEffectiveEntitlements, isSubscriptionPlanEligible, planFromRow } from "./entitlements";
export { isSubscriptionPlanEligible } from "./entitlements";
import { query, transaction } from "@/db";

export type BillingInterval = "month" | "year";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid";

export class BillingError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "BILLING_ERROR") { super(message); }
}

export type BillingSummary = {
  provider: "none" | "stripe" | "manual";
  providerConfigured: boolean;
  accountStatus: string;
  billingEmail: string | null;
  plan: { id: string; name: string; description: string; currency: string; monthlyPriceCents: number; annualPriceCents: number; monthlyRequestLimit: number; monthlyTokenLimit: number; maxMembers: number; features: Record<string, boolean> };
  subscription: null | { id: string; status: SubscriptionStatus; interval: BillingInterval; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };
  usage: { month: string; requests: number; tokens: number; requestLimit: number; tokenLimit: number };
  availablePlans: BillingSummary["plan"][];
};

function providerConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

function publicBaseUrl() {
  const raw = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!raw) throw new BillingError("请先配置 AUTH_URL，支付回调需要明确的应用地址", 503, "BILLING_URL_NOT_CONFIGURED");
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new BillingError("生产环境支付必须使用 HTTPS", 503, "BILLING_HTTPS_REQUIRED");
  return url.origin;
}

function unixDate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

async function ensureBillingAccount(companyId: string) {
  await query("INSERT INTO billing_accounts(company_id) VALUES($1) ON CONFLICT(company_id) DO NOTHING", [companyId]);
}

export async function getBillingSummary(companyId: string): Promise<BillingSummary> {
  await ensureBillingAccount(companyId);
  const [account, entitlements, plans, usage] = await Promise.all([
    query("SELECT provider,status,billing_email FROM billing_accounts WHERE company_id=$1", [companyId]),
    getEffectiveEntitlements(companyId),
    query("SELECT * FROM billing_plans WHERE is_active=true ORDER BY monthly_price_cents,id", []),
    query(`SELECT count(*) FILTER (WHERE status IN ('pending','success','failed'))::int AS requests,
      coalesce(sum(CASE WHEN status IN ('success','failed') THEN tokens_used WHEN status='pending' THEN reserved_tokens ELSE 0 END),0)::bigint AS tokens
      FROM ai_usage_events WHERE company_id=$1 AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [companyId]),
  ]);
  const availablePlans = plans.rows.map(row => planFromRow(row));
  const active = entitlements.subscription;
  const plan = entitlements.plan;
  if (!plan) throw new BillingError("计费套餐尚未初始化，请先执行数据库迁移", 503, "BILLING_SCHEMA_NOT_READY");
  const a = account.rows[0] || {};
  return {
    provider: (a.provider || "none") as BillingSummary["provider"], providerConfigured: providerConfigured(),
    accountStatus: String(a.status || "not_configured"), billingEmail: a.billing_email || null,
    plan, subscription: active ? {
      id: String(active.id), status: active.status as SubscriptionStatus, interval: active.billing_interval as BillingInterval,
      currentPeriodEnd: active.current_period_end ? new Date(active.current_period_end).toISOString() : null,
      cancelAtPeriodEnd: active.cancel_at_period_end === true,
    } : null,
    usage: { month: new Date().toISOString().slice(0, 7), requests: Number(usage.rows[0]?.requests || 0), tokens: Number(usage.rows[0]?.tokens || 0), requestLimit: entitlements.requestLimit, tokenLimit: entitlements.tokenLimit },
    availablePlans,
  };
}

async function stripeRequest(path: string, params: URLSearchParams, method = "POST", idempotencyKey?: string) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new BillingError("支付服务尚未配置，请联系平台管理员", 503, "BILLING_NOT_CONFIGURED");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, redirect: "error", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: method === "GET" ? undefined : params.toString(), signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = data?.error && typeof data.error === "object" ? data.error as Record<string, unknown> : {};
    throw new BillingError(typeof error.message === "string" ? error.message.slice(0, 200) : "支付服务请求失败", response.status >= 500 ? 503 : 400, "BILLING_PROVIDER_ERROR");
  }
  return data || {};
}

export async function createCheckoutSession(companyId: string, billingEmail: string, planId: string, interval: BillingInterval) {
  if (!providerConfigured()) throw new BillingError("支付尚未启用：请配置 Stripe Secret、Webhook Secret 和价格 ID", 503, "BILLING_NOT_CONFIGURED");
  const plan = (await query("SELECT id,provider_monthly_price_id,provider_annual_price_id FROM billing_plans WHERE id=$1 AND is_active=true", [planId])).rows[0];
  const priceId = interval === "year" ? plan?.provider_annual_price_id : plan?.provider_monthly_price_id;
  if (!priceId) throw new BillingError("该套餐尚未配置支付价格 ID，不能创建结算会话", 503, "BILLING_PRICE_NOT_CONFIGURED");
  await ensureBillingAccount(companyId);
  const params = new URLSearchParams({
    mode: "subscription", customer_email: billingEmail.trim().toLowerCase(), client_reference_id: companyId,
    success_url: `${publicBaseUrl()}/app/billing?checkout=success`, cancel_url: `${publicBaseUrl()}/app/billing?checkout=cancelled`,
    "line_items[0][price]": priceId, "line_items[0][quantity]": "1",
    "subscription_data[metadata][company_id]": companyId, "subscription_data[metadata][plan_id]": planId,
    "subscription_data[metadata][billing_interval]": interval,
  });
  const data = await stripeRequest("checkout/sessions", params, "POST", `checkout-${companyId}-${planId}-${interval}-${Date.now()}`);
  if (typeof data.id !== "string" || typeof data.url !== "string") throw new BillingError("支付服务没有返回结算地址", 503, "BILLING_PROVIDER_RESPONSE");
  return { id: data.id, url: data.url };
}

export function verifyStripeSignature(payload: string, signature: string, secret: string, toleranceSeconds = 300) {
  const parts = signature.split(",").map(item => item.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value).filter(Boolean) as string[];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds || !signatures.length) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signatures.some(candidate => {
    try { const a = Buffer.from(candidate, "hex"); const b = Buffer.from(expected, "hex"); return a.length === b.length && timingSafeEqual(a, b); } catch { return false; }
  });
}

function eventCompanyId(event: Record<string, unknown>) {
  const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
  const object = data.object && typeof data.object === "object" ? data.object as Record<string, unknown> : {};
  const metadata = object.metadata && typeof object.metadata === "object" ? object.metadata as Record<string, unknown> : {};
  const candidate = metadata.company_id || object.client_reference_id;
  return typeof candidate === "string" && /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stripeObjectId(value: unknown): string | null {
  const id = typeof value === "string" ? value : recordValue(value).id;
  return typeof id === "string" && /^sub_[A-Za-z0-9]+$/.test(id) ? id : null;
}

export function stripeSubscriptionId(eventType: string, object: Record<string, unknown>): string | null {
  if (eventType.startsWith("customer.subscription.")) return stripeObjectId(object.id);
  if (!eventType.startsWith("invoice.")) return null;
  const direct = stripeObjectId(object.subscription);
  if (direct) return direct;
  const parent = recordValue(object.parent);
  const subscriptionDetails = recordValue(parent.subscription_details);
  return stripeObjectId(subscriptionDetails.subscription);
}

function stripeSubscriptionStatus(object: Record<string, unknown>): SubscriptionStatus | null {
  const raw = object.status;
  return typeof raw === "string" && ["trialing", "active", "past_due", "paused", "canceled", "incomplete", "incomplete_expired", "unpaid"].includes(raw)
    ? raw as SubscriptionStatus : null;
}

export async function retrieveStripeSubscription(id: string) {
  return stripeRequest(`subscriptions/${encodeURIComponent(id)}`,new URLSearchParams(),"GET");
}

/** Event ordering is not trusted. Every relevant event reconciles the current
 * Stripe subscription while serialized by subscription/customer/company locks.
 * Failed retrieval rolls back the event receipt so Stripe can safely retry. */
export async function handleStripeEvent(payload: string, signature: string, retrieve = retrieveStripeSubscription) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !verifyStripeSignature(payload,signature,secret)) throw new BillingError("支付回调签名无效或已过期",401,"BILLING_SIGNATURE_INVALID");
  let event: Record<string,unknown>;
  try { event = recordValue(JSON.parse(payload)); } catch { throw new BillingError("支付回调 JSON 无效",400,"BILLING_PAYLOAD_INVALID"); }
  const eventId = typeof event.id === "string" ? event.id : "", eventType = typeof event.type === "string" ? event.type : "";
  if (!/^evt_[A-Za-z0-9]+$/.test(eventId) || !eventType || eventType.length > 100 || !Number.isSafeInteger(event.created) || Number(event.created) < 0) throw new BillingError("支付回调缺少有效事件标识或创建时间",400,"BILLING_EVENT_INVALID");
  const digest = createHash("sha256").update(payload).digest("hex");
  const object = recordValue(recordValue(event.data).object);
  const subscriptionId = stripeSubscriptionId(eventType,object);
  return transaction(async client => {
    const inserted = await client.query(`INSERT INTO payment_events(provider,event_id,event_type,payload_sha256,status)
      VALUES('stripe',$1,$2,$3,'received') ON CONFLICT(provider,event_id) DO NOTHING RETURNING event_id`,[eventId,eventType,digest]);
    if (!inserted.rowCount) {
      const receipt = (await client.query("SELECT company_id,payload_sha256 FROM payment_events WHERE provider='stripe' AND event_id=$1",[eventId])).rows[0];
      if (receipt.payload_sha256 !== digest) throw new BillingError("相同事件编号的内容不一致",409,"BILLING_EVENT_CONFLICT");
      return { duplicate:true,companyId:receipt.company_id };
    }
    if (!subscriptionId) {
      await client.query("UPDATE payment_events SET status='ignored',processed_at=now() WHERE provider='stripe' AND event_id=$1",[eventId]);
      return { duplicate:false,companyId:null };
    }
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`stripe-subscription:${subscriptionId}`]);
    const existing = (await client.query("SELECT * FROM subscriptions WHERE provider='stripe' AND provider_subscription_id=$1",[subscriptionId])).rows[0];
    let canonical: Record<string,unknown>;
    try { canonical = await retrieve(subscriptionId); }
    catch { throw new BillingError("支付订阅权威状态暂不可用，请重试回调",503,"BILLING_RECONCILIATION_UNAVAILABLE"); }
    const status = stripeSubscriptionStatus(canonical);
    if (canonical.id !== subscriptionId || !status) throw new BillingError("支付服务返回了无效订阅",503,"BILLING_SUBSCRIPTION_INVALID");
    if (existing && ["canceled","incomplete_expired"].includes(existing.status) && !["canceled","incomplete_expired"].includes(status)) throw new BillingError("终止订阅不可被旧事件恢复",409,"BILLING_TERMINAL_STATE");
    const customer = typeof canonical.customer === "string" ? canonical.customer : recordValue(canonical.customer).id;
    if (typeof customer !== "string" || !/^cus_[A-Za-z0-9]+$/.test(customer)) throw new BillingError("订阅缺少有效客户标识",503,"BILLING_CUSTOMER_INVALID");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`stripe-customer:${customer}`]);
    const accounts = (await client.query("SELECT company_id FROM billing_accounts WHERE provider='stripe' AND provider_customer_id=$1",[customer])).rows;
    if (accounts.length > 1) throw new BillingError("支付客户归属冲突",409,"BILLING_TENANT_CONFLICT");
    const canonicalCompany = eventCompanyId({ data:{ object:canonical } });
    const eventCompany = eventCompanyId(event);
    const companyId = existing?.company_id || accounts[0]?.company_id || canonicalCompany;
    if (!companyId) throw new BillingError("订阅尚未绑定工作区",409,"BILLING_TENANT_UNBOUND");
    if ([canonicalCompany,eventCompany,accounts[0]?.company_id].some(id => id && id !== companyId)) throw new BillingError("订阅不能转移到其他工作区",409,"BILLING_TENANT_CONFLICT");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[companyId]);
    const company = await client.query("SELECT id FROM companies WHERE id=$1 FOR UPDATE",[companyId]);
    if (!company.rowCount) throw new BillingError("工作区不存在",409,"BILLING_TENANT_UNBOUND");
    const account = (await client.query("SELECT provider_customer_id FROM billing_accounts WHERE company_id=$1 FOR UPDATE",[companyId])).rows[0];
    if (account?.provider_customer_id && account.provider_customer_id !== customer) throw new BillingError("工作区已绑定另一个支付客户",409,"BILLING_TENANT_CONFLICT");
    const items = recordValue(canonical.items).data;
    const item = Array.isArray(items) && items.length === 1 ? recordValue(items[0]) : {};
    const price = recordValue(item.price);
    const interval = recordValue(price.recurring).interval;
    const matched = typeof price.id === "string" && ["month","year"].includes(String(interval)) && item.quantity === 1
      ? (await client.query(`SELECT id FROM billing_plans WHERE is_active=true AND
        (($2='month' AND provider_monthly_price_id=$1) OR ($2='year' AND provider_annual_price_id=$1))`,[price.id,interval])).rows : [];
    // Price IDs are controlled by the server's catalog, not caller metadata.
    if (matched.length !== 1 && isSubscriptionPlanEligible(status)) throw new BillingError("订阅价格未匹配到唯一有效套餐",503,"BILLING_PRICE_UNMAPPED");
    const planId = matched[0]?.id || existing?.plan_id;
    if (!planId) throw new BillingError("订阅套餐不可识别",503,"BILLING_PRICE_UNMAPPED");
    const billingInterval = ["month","year"].includes(String(interval)) ? interval : existing?.billing_interval;
    if (!billingInterval) throw new BillingError("订阅周期不可识别",503,"BILLING_PERIOD_INVALID");
    const result = await client.query(`INSERT INTO subscriptions(id,company_id,plan_id,provider,provider_subscription_id,status,billing_interval,current_period_start,current_period_end,trial_end,cancel_at_period_end,canceled_at,metadata,provider_event_created,provider_event_id,reconciled_at)
      VALUES($1,$2,$3,'stripe',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,now())
      ON CONFLICT(provider,provider_subscription_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status=EXCLUDED.status,billing_interval=EXCLUDED.billing_interval,current_period_start=EXCLUDED.current_period_start,current_period_end=EXCLUDED.current_period_end,trial_end=EXCLUDED.trial_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,canceled_at=EXCLUDED.canceled_at,metadata=EXCLUDED.metadata,
      provider_event_created=greatest(subscriptions.provider_event_created,EXCLUDED.provider_event_created),provider_event_id=EXCLUDED.provider_event_id,reconciled_at=now(),updated_at=now()
      WHERE subscriptions.company_id=EXCLUDED.company_id RETURNING id`,[randomUUID(),companyId,planId,subscriptionId,status,billingInterval,unixDate(canonical.current_period_start ?? item.current_period_start),unixDate(canonical.current_period_end ?? item.current_period_end),unixDate(canonical.trial_end),canonical.cancel_at_period_end === true,unixDate(canonical.canceled_at),JSON.stringify(recordValue(canonical.metadata)),event.created,eventId]);
    if (!result.rowCount) throw new BillingError("订阅工作区归属冲突",409,"BILLING_TENANT_CONFLICT");
    const accountStatus = isSubscriptionPlanEligible(status) ? "active" : ["past_due","unpaid"].includes(status) ? "past_due" : status === "paused" ? "paused" : "not_configured";
    await client.query(`INSERT INTO billing_accounts(company_id,provider,provider_customer_id,status) VALUES($1,'stripe',$2,$3)
      ON CONFLICT(company_id) DO UPDATE SET provider='stripe',provider_customer_id=EXCLUDED.provider_customer_id,status=CASE WHEN billing_accounts.status='closed' THEN 'closed' ELSE EXCLUDED.status END,updated_at=now()`,[companyId,customer,accountStatus]);
    await client.query("UPDATE payment_events SET company_id=$2,status='processed',processed_at=now() WHERE provider='stripe' AND event_id=$1",[eventId,companyId]);
    return { duplicate:false,companyId };
  });
}

import type { PoolClient } from "pg";
import { query } from "@/db";

function quota(value: unknown) { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
function cap(name: string, fallback: number) { return process.env[name] === undefined ? fallback : quota(process.env[name]); }
export function isSubscriptionPlanEligible(status: unknown): status is "active" | "trialing" { return status === "active" || status === "trialing"; }
export function hasCurrentSubscription(row: Record<string, unknown>, now = Date.now()) {
  if (!isSubscriptionPlanEligible(row.status)) return false;
  const end = new Date(row.current_period_end as string).getTime();
  if (!Number.isFinite(end) || end <= now) return false;
  if (row.status === "trialing" && row.trial_end && new Date(row.trial_end as string).getTime() <= now) return false;
  return true; // cancel_at_period_end retains rights only until this exact end.
}
export function planFromRow(row: Record<string, unknown>) {
  const raw = row.features && typeof row.features === "object" && !Array.isArray(row.features) ? row.features as Record<string,unknown> : {};
  return { id:String(row.id),name:String(row.name),description:String(row.description || ""),currency:String(row.currency || "USD"),
    monthlyPriceCents:quota(row.monthly_price_cents),annualPriceCents:quota(row.annual_price_cents),monthlyRequestLimit:quota(row.monthly_request_limit),monthlyTokenLimit:quota(row.monthly_token_limit),maxMembers:quota(row.max_members),
    features:Object.fromEntries(Object.entries(raw).filter(([,value]) => typeof value === "boolean")) as Record<string,boolean> };
}
export function effectiveAIQuota(plan: { monthlyRequestLimit: number; monthlyTokenLimit: number }, settings?: Record<string,unknown>, enabled = true) {
  return { requestLimit: enabled ? Math.min(quota(plan.monthlyRequestLimit),cap("AI_PLATFORM_MONTHLY_REQUEST_LIMIT",10000),settings ? quota(settings.monthly_request_limit) : Infinity) : 0,
    tokenLimit: enabled ? Math.min(quota(plan.monthlyTokenLimit),cap("AI_PLATFORM_MONTHLY_TOKEN_LIMIT",10000000),settings ? quota(settings.monthly_token_limit) : Infinity) : 0 };
}

/** One resolver for both display and execution. Call inside the quota reservation
 * transaction while holding the company lock; webhook writes use the same lock. */
export async function getEffectiveEntitlements(companyId: string, client?: PoolClient) {
  const execute = client ? client.query.bind(client) : query;
  const company = (await execute("SELECT is_active FROM companies WHERE id=$1",[companyId])).rows[0];
  const account = (await execute("SELECT status FROM billing_accounts WHERE company_id=$1",[companyId])).rows[0];
  const subscription = (await execute(`SELECT * FROM subscriptions WHERE company_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,[companyId])).rows[0];
  const paid = subscription && hasCurrentSubscription(subscription);
  const row = (await execute("SELECT * FROM billing_plans WHERE id=$1 AND is_active=true",[paid ? subscription.plan_id : "free"])).rows[0];
  if (!row) throw new Error("计费套餐未初始化或已停用，拒绝执行 AI");
  const settings = (await execute("SELECT monthly_request_limit,monthly_token_limit,enabled FROM tenant_ai_settings WHERE company_id=$1",[companyId])).rows[0];
  const plan = planFromRow(row);
  const enabled = company?.is_active === true && !["closed","paused"].includes(account?.status) && settings?.enabled === true;
  return { plan,subscription:subscription || null,...effectiveAIQuota(plan,settings,enabled) };
}

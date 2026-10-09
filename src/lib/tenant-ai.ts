import { getEffectiveEntitlements } from "./billing/entitlements";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query, transaction } from "@/db";
import type { PoolClient } from "pg";
import { TEXT_PROVIDERS, type TextProviderId } from "@/lib/api-config/providers";
import { AI_TASKS } from "@/lib/api-config/schema";
import { decryptTenantSecret, encryptTenantSecret } from "@/lib/tenant-secret";
import type { ChatCompletionRequest } from "@/lib/ai/chat-completions";

export const TENANT_AI_PROVIDERS = ["openai", "kimi", "doubao", "gemini", "zhipu", "deepseek", "tongyi", "openrouter", "siliconflow"] as const;
const settingsInput = z.object({
  provider: z.enum(TENANT_AI_PROVIDERS),
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().trim().max(8192).default(""),
  clearApiKey: z.boolean().default(false),
  enabled: z.boolean().default(true),
  monthlyRequestLimit: z.number().int().min(1).max(10000),
  monthlyTokenLimit: z.number().int().min(1000).max(10000000),
}).strict();
export type TenantAISettingsInput = z.infer<typeof settingsInput>;

export class TenantAIError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

function publicSettings(row: Record<string, unknown> | undefined) {
  if (!row) return { configured: false, enabled: false, provider: "openai", model: "", hasApiKey: false, monthlyRequestLimit: 1000, monthlyTokenLimit: 500000 };
  return {
    configured: true,
    enabled: row.enabled === true,
    provider: row.provider,
    model: row.model,
    hasApiKey: typeof row.api_key_ciphertext === "string" && row.api_key_ciphertext.length > 0,
    monthlyRequestLimit: Number(row.monthly_request_limit),
    monthlyTokenLimit: Number(row.monthly_token_limit),
    updatedAt: row.updated_at,
  };
}

async function requireWorkspaceAdmin(client: PoolClient, companyId: string, userId: string) {
  const result = await client.query(`SELECT u.role,u.is_active,u.settings,c.is_active AS company_active
    FROM users u JOIN companies c ON c.id=u.company_id WHERE u.id=$1 AND u.company_id=$2 FOR UPDATE OF u`, [userId, companyId]);
  const user = result.rows[0];
  if (!user || user.is_active !== true || user.company_active !== true || user.settings?.mustChangePassword === true) throw new TenantAIError("工作区或账号不可用，请重新登录", 403);
  if (!(["owner", "admin"] as string[]).includes(user.role)) throw new TenantAIError("只有工作区所有者或管理员可以管理 AI 配置", 403);
}

export async function getTenantAISettings(companyId: string) {
  const result = await query("SELECT provider,model,api_key_ciphertext,enabled,monthly_request_limit,monthly_token_limit,updated_at FROM tenant_ai_settings WHERE company_id=$1", [companyId]);
  const entitlements = await getEffectiveEntitlements(companyId);
  return { ...publicSettings(result.rows[0]), effectiveRequestLimit: entitlements.requestLimit, effectiveTokenLimit: entitlements.tokenLimit, plan: entitlements.plan.name };
}

export async function saveTenantAISettings(companyId: string, actorId: string, input: unknown) {
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) throw new TenantAIError(parsed.error.issues[0]?.message || "AI 配置格式不正确");
  return transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [companyId]);
    await client.query("SELECT id FROM companies WHERE id=$1 FOR UPDATE", [companyId]);
    await requireWorkspaceAdmin(client, companyId, actorId);
    const existing = await client.query("SELECT provider,api_key_ciphertext FROM tenant_ai_settings WHERE company_id=$1 FOR UPDATE", [companyId]);
    const current = existing.rows[0];
    let encrypted = current?.api_key_ciphertext as string | null | undefined;
    if (parsed.data.clearApiKey) encrypted = null;
    else if (parsed.data.apiKey) encrypted = encryptTenantSecret(parsed.data.apiKey, "ai-provider", companyId);
    else if (current?.provider && current.provider !== parsed.data.provider) throw new TenantAIError("切换 AI 服务商后必须重新填写对应的 API Key");
    if (parsed.data.enabled && !encrypted) throw new TenantAIError("启用 AI 前请先填写 API Key");
    await client.query(`INSERT INTO tenant_ai_settings(company_id,provider,model,api_key_ciphertext,enabled,monthly_request_limit,monthly_token_limit,updated_by,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())
      ON CONFLICT(company_id) DO UPDATE SET provider=EXCLUDED.provider,model=EXCLUDED.model,api_key_ciphertext=EXCLUDED.api_key_ciphertext,
        enabled=EXCLUDED.enabled,monthly_request_limit=EXCLUDED.monthly_request_limit,monthly_token_limit=EXCLUDED.monthly_token_limit,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [companyId, parsed.data.provider, parsed.data.model, encrypted, parsed.data.enabled, parsed.data.monthlyRequestLimit, parsed.data.monthlyTokenLimit, actorId]);
    await client.query("INSERT INTO audit_events(company_id,actor_id,action,target_id,details) VALUES($1,$2,'tenant.ai_settings.update',$3,$4::jsonb)", [companyId, actorId, companyId, JSON.stringify({ provider: parsed.data.provider, enabled: parsed.data.enabled, monthlyRequestLimit: parsed.data.monthlyRequestLimit, monthlyTokenLimit: parsed.data.monthlyTokenLimit, keyChanged: Boolean(parsed.data.apiKey || parsed.data.clearApiKey) })]);
    const result = await client.query("SELECT provider,model,api_key_ciphertext,enabled,monthly_request_limit,monthly_token_limit,updated_at FROM tenant_ai_settings WHERE company_id=$1", [companyId]);
    const entitlements = await getEffectiveEntitlements(companyId,client);
    return { ...publicSettings(result.rows[0]), effectiveRequestLimit:entitlements.requestLimit, effectiveTokenLimit:entitlements.tokenLimit, plan:entitlements.plan.name };
  });
}

async function getTenantAIUsageTotals(companyId: string) {
  const usage = await query(`SELECT count(*) FILTER(WHERE status IN ('pending','success','failed'))::int AS requests,
    coalesce(sum(CASE WHEN status IN ('success','failed') THEN tokens_used WHEN status='pending' THEN reserved_tokens ELSE 0 END),0)::bigint AS tokens,
    count(*) FILTER(WHERE status='failed')::int AS failures
    FROM ai_usage_events WHERE company_id=$1 AND created_at >= date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [companyId]);
  return { requests: Number(usage.rows[0].requests), tokens: Number(usage.rows[0].tokens), failures: Number(usage.rows[0].failures) };
}

export async function getTenantAIUsage(companyId: string) {
  const [usage, recent] = await Promise.all([
    getTenantAIUsageTotals(companyId),
    query(`SELECT id,task,provider,model,status,tokens_used,failure_code,created_at AS "createdAt"
      FROM ai_usage_events WHERE company_id=$1 AND status <> 'abandoned' ORDER BY created_at DESC LIMIT 30`, [companyId]),
  ]);
  return { month: new Date().toISOString().slice(0, 7), ...usage, recent: recent.rows };
}

/** Safe for workspace members: no key, ciphertext, prompt or usage log is returned.
 * Readiness is advisory; reservations recheck authority and budget atomically. */
export async function getTenantAIReadiness(companyId: string) {
  const [settings, usage] = await Promise.all([getTenantAISettings(companyId), getTenantAIUsageTotals(companyId)]);
  let unavailableReason = "";
  if (!settings.enabled || !settings.hasApiKey || !settings.model) unavailableReason = "请先由工作区管理员在「AI 用量」配置并启用租户 AI Key";
  else if (usage.requests >= settings.effectiveRequestLimit || usage.tokens >= settings.effectiveTokenLimit) unavailableReason = "本月 AI 有效额度不可用或已用完，请联系工作区管理员检查「订阅计费」和「AI 用量」";
  return { textReady: !unavailableReason, scope: "tenant" as const, configurationUrl: "/app/ai-usage", unavailableReason };
}

function estimateTokenReservation(input: Pick<ChatCompletionRequest, "messages" | "maxTokens">) {
  const chars = input.messages.reduce((total, message) => total + Buffer.byteLength(message.content,"utf8"), 0);
  const output = Math.max(1, Math.min(8192, Number(input.maxTokens) || 2048));
  return Math.max(1, chars + output + input.messages.length * 40);
}

export async function reserveTenantAIRequest(companyId: string, userId: string, task: string, input: Pick<ChatCompletionRequest, "messages" | "maxTokens">) {
  if (!Object.hasOwn(AI_TASKS, task)) throw new TenantAIError("未知的 AI 功能");
  const id = randomUUID();
  const reserve = estimateTokenReservation(input);
  return transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [companyId]);
    const company = await client.query("SELECT id FROM companies WHERE id=$1 AND is_active=true FOR UPDATE",[companyId]);
    const actor = (await client.query("SELECT is_active,settings FROM users WHERE id=$1 AND company_id=$2",[userId,companyId])).rows[0];
    if (!company.rowCount || !actor?.is_active || actor.settings?.mustChangePassword) throw new TenantAIError("账号或工作区不可用",403);
    const entitlements = await getEffectiveEntitlements(companyId,client);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`tenant-ai-budget:${companyId}:${new Date().toISOString().slice(0,7)}`]);
    await client.query("UPDATE ai_usage_events SET status='failed',tokens_used=reserved_tokens,reserved_tokens=0,failure_code='reservation_expired',completed_at=now() WHERE company_id=$1 AND status='pending' AND created_at < now()-interval '15 minutes'", [companyId]);
    const configResult = await client.query("SELECT provider,model,api_key_ciphertext,enabled,monthly_request_limit,monthly_token_limit FROM tenant_ai_settings WHERE company_id=$1 FOR UPDATE", [companyId]);
    const setting = configResult.rows[0];
    if (!setting || setting.enabled !== true || !setting.api_key_ciphertext) throw new TenantAIError("请先由工作区管理员在「AI 用量」配置并启用租户 AI Key", 503);
    const totals = await client.query(`SELECT count(*) FILTER(WHERE status IN ('pending','success','failed'))::int AS requests,
      coalesce(sum(CASE WHEN status IN ('success','failed') THEN tokens_used WHEN status='pending' THEN reserved_tokens ELSE 0 END),0)::bigint AS tokens
      FROM ai_usage_events WHERE company_id=$1 AND created_at >= date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [companyId]);
    if (Number(totals.rows[0].requests) >= entitlements.requestLimit) throw new TenantAIError("本月 AI 请求次数已达到有效上限（套餐、平台和工作区预算的最低值），请检查订阅和预算", 429);
    if (Number(totals.rows[0].tokens) + reserve > entitlements.tokenLimit) throw new TenantAIError("本月 AI Token 有效预算不足，请降低输出长度或检查订阅和预算", 429);
    await client.query(`INSERT INTO ai_usage_events(id,company_id,user_id,task,provider,model,status,reserved_tokens)
      VALUES($1,$2,$3,$4,$5,$6,'pending',$7)`, [id, companyId, userId, task, setting.provider, setting.model, reserve]);
    return {
      id, provider: setting.provider as TextProviderId, model: setting.model,
      apiKey: decryptTenantSecret(setting.api_key_ciphertext, "ai-provider", companyId), reservedTokens: reserve,
      maxTokens: Math.max(1,Math.min(8192,Number(input.maxTokens) || 2048)),
      baseUrl: TEXT_PROVIDERS[setting.provider as TextProviderId].baseUrl,
    };
  });
}

export async function finishTenantAIRequest(id: string, result: { ok: boolean; promptTokens?: number; completionTokens?: number; fallbackTokens: number; failureCode?: string }) {
  const promptTokens = Math.max(0, Math.min(10_000_000, Math.trunc(result.promptTokens || 0)));
  const completionTokens = Math.max(0, Math.min(10_000_000, Math.trunc(result.completionTokens || 0)));
  const tokens = Math.max(0,Math.trunc(promptTokens + completionTokens || result.fallbackTokens));
  await query(`UPDATE ai_usage_events SET status=$2,reserved_tokens=0,prompt_tokens=$3,completion_tokens=$4,tokens_used=$5,failure_code=$6,completed_at=now()
    WHERE id=$1 AND status='pending'`, [id, result.ok ? "success" : "failed", promptTokens, completionTokens, tokens, result.ok ? null : result.failureCode?.slice(0,60) || "upstream_error"]);
}

export function tenantAIProviderBaseUrl(provider: string) {
  if (!(TENANT_AI_PROVIDERS as readonly string[]).includes(provider)) throw new TenantAIError("不支持的租户 AI 服务商");
  return TEXT_PROVIDERS[provider as TextProviderId].baseUrl;
}

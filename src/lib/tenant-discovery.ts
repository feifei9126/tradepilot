import { currentWorkspace } from "./workspace-context";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query, transaction } from "@/db";
import { encryptTenantSecret, decryptTenantSecret } from "./tenant-secret";
import { ProspectingError } from "./prospecting";
import { searchPublicPages } from "./prospecting-discovery";
import { scrapeWithFirecrawl } from "./firecrawl/client";
import { assertPublicUrl } from "./firecrawl/security";

const schema = z.object({ apiKey: z.string().trim().max(8192).default(""), clearApiKey: z.boolean().default(false), enabled: z.boolean(), dailyRequestLimit: z.number().int().min(1).max(1000) }).strict();
function platformActor(companyId: string, actorId: string) { const ws = currentWorkspace(); return ws?.isPlatformAdmin === true && ws.companyId === companyId && ws.userId === actorId; }
function platformCap() {
  const n = Number(process.env.FIRECRAWL_TENANT_DAILY_REQUEST_LIMIT || "20");
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 20;
}
function publicSettings(row?: Record<string, unknown>) {
  return { configured: Boolean(row), hasApiKey: Boolean(row?.api_key_ciphertext), enabled: row?.enabled === true, dailyRequestLimit: Number(row?.daily_request_limit || 20), platformDailyLimit: platformCap(), endpoint: "https://api.firecrawl.dev" };
}
export async function getTenantDiscoverySettings(companyId: string) {
  const [settings, usage] = await Promise.all([
    query("SELECT * FROM tenant_discovery_settings WHERE company_id=$1", [companyId]),
    query("SELECT count(*)::int AS requests FROM discovery_usage_events WHERE company_id=$1 AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'", [companyId]),
  ]);
  return { ...publicSettings(settings.rows[0]), requestsToday: Number(usage.rows[0].requests) };
}
export async function saveTenantDiscoverySettings(companyId: string, actorId: string, input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ProspectingError("请填写有效的 Firecrawl Key 和每日请求预算");
  return transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [companyId]);
    const company = await client.query("SELECT id FROM companies WHERE id=$1 AND is_active=true FOR UPDATE", [companyId]);
    if (!company.rowCount) throw new ProspectingError("工作区不可用",403);
    if (!platformActor(companyId, actorId)) {
      const user = (await client.query("SELECT role,is_active,settings FROM users WHERE company_id=$1 AND id=$2 FOR UPDATE", [companyId, actorId])).rows[0];
      if (!user || !user.is_active || user.settings?.mustChangePassword || !["owner", "admin"].includes(user.role)) throw new ProspectingError("仅工作区管理员可配置获客服务", 403);
    }
    const existing = (await client.query("SELECT api_key_ciphertext FROM tenant_discovery_settings WHERE company_id=$1 FOR UPDATE", [companyId])).rows[0];
    const ciphertext = parsed.data.clearApiKey ? null : parsed.data.apiKey ? encryptTenantSecret(parsed.data.apiKey, "firecrawl", companyId) : existing?.api_key_ciphertext || null;
    if (parsed.data.enabled && !ciphertext) throw new ProspectingError("启用前必须填写自己的 Firecrawl Cloud API Key");
    await client.query(`INSERT INTO tenant_discovery_settings(company_id,api_key_ciphertext,enabled,daily_request_limit,updated_by)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(company_id) DO UPDATE SET api_key_ciphertext=EXCLUDED.api_key_ciphertext,enabled=EXCLUDED.enabled,daily_request_limit=EXCLUDED.daily_request_limit,updated_by=EXCLUDED.updated_by,updated_at=now()`, [companyId,ciphertext,parsed.data.enabled,parsed.data.dailyRequestLimit,actorId]);
    await client.query("INSERT INTO audit_events(company_id,actor_id,action,target_id) VALUES($1,$2,'tenant.discovery_settings.update',$3)", [companyId,actorId,companyId]);
    return { ok: true };
  });
}
export async function reserveTenantDiscovery(companyId: string, actorId: string) {
  return transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [companyId]);
    const company = await client.query("SELECT id FROM companies WHERE id=$1 AND is_active=true FOR UPDATE", [companyId]);
    if (!company.rowCount) throw new ProspectingError("工作区不可用",403);
    if (!platformActor(companyId, actorId)) {
      const user = (await client.query("SELECT is_active,settings FROM users WHERE company_id=$1 AND id=$2", [companyId, actorId])).rows[0];
      if (!user?.is_active || user.settings?.mustChangePassword) throw new ProspectingError("账号不可用", 403);
    }
    const settings = (await client.query("SELECT * FROM tenant_discovery_settings WHERE company_id=$1 FOR UPDATE", [companyId])).rows[0];
    if (!settings?.enabled || !settings.api_key_ciphertext) throw new ProspectingError("请先在 AI 获客的服务配置中填写本工作区的 Firecrawl Cloud Key；不会使用平台共享 Key",503);
    const used = Number((await client.query("SELECT count(*)::int AS requests FROM discovery_usage_events WHERE company_id=$1 AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'", [companyId])).rows[0].requests);
    const limit = Math.min(platformCap(),Number(settings.daily_request_limit));
    if (used >= limit) throw new ProspectingError(`本工作区今日获客请求已达到上限（${used}/${limit}）`,429);
    const id = randomUUID();
    const apiKey = decryptTenantSecret(settings.api_key_ciphertext,"firecrawl",companyId);
    await client.query("INSERT INTO discovery_usage_events(id,company_id,actor_id) VALUES($1,$2,$3)", [id,companyId,actorId]);
    return { id, apiKey };
  });
}
/** Search and product previews reserve the same workspace daily quota before
 * contacting the provider. Failures and unfinished requests retain their cost. */
async function runTenantDiscovery<T>(companyId: string, actorId: string, execute: (apiKey: string) => Promise<T>): Promise<T> {
  const reservation = await reserveTenantDiscovery(companyId, actorId);
  let ok = false;
  try { const result = await execute(reservation.apiKey); ok = true; return result; }
  finally { await query("UPDATE discovery_usage_events SET status=$3,completed_at=now() WHERE id=$1 AND company_id=$2", [reservation.id, companyId, ok ? "success" : "failed"]); }
}
export async function searchTenantPublicPages(companyId: string, actorId: string, search: string) {
  return runTenantDiscovery(companyId, actorId, apiKey => searchPublicPages(search, { apiKey }));
}
export async function scrapeTenantPublicPage(companyId: string, actorId: string, sourceUrl: string) {
  // Invalid/private sources do not consume quota or contact the provider.
  try { await assertPublicUrl(sourceUrl); }
  catch { throw new ProspectingError("请提供可公开访问、不含凭据的 HTTP 或 HTTPS 产品链接", 400); }
  return runTenantDiscovery(companyId, actorId, async apiKey => {
    try { return await scrapeWithFirecrawl(sourceUrl, { apiKey }); }
    catch { throw new ProspectingError("Firecrawl 抓取失败，请检查工作区 Cloud Key 和公网来源链接", 502); }
  });
}

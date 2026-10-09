import { BillingError } from "./billing";
import { TenantAIError } from "./tenant-ai";
import { ProspectingError } from "./prospecting";
import { randomUUID } from "node:crypto";
import { RequestBodyError } from "./request-json";
import { crossSiteMutation } from "./request-security";
import { auth } from "@/lib/auth";
import { query, DatabaseUnavailableError, isDatabaseConfigured } from "@/db";
import { CrmRepository, CrmError } from "./crm-repository";
import { currentWorkspace, runInWorkspace } from "./workspace-context";
import { takeDistributedRateLimit } from "./distributed-rate-limit";

function policyFor(request: Request | undefined) {
  if (!request) return null;
  const path = new URL(request.url).pathname;
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  const intensive = path === "/api/products/import" || ["/api/ai", "/api/prospecting", "/api/product-videos", "/api/firecrawl"]
    .some(prefix => path === prefix || path.startsWith(prefix + "/"));
  const bulk = path.includes("/import") || path.includes("/export");
  return { limit: intensive ? 20 : bulk ? 20 : 120, seconds: 60, bucket: intensive ? "expensive" : bulk ? "bulk" : "write" };
}

async function invoke<T extends (...args: never[]) => Promise<Response>>(handler: T, args: Parameters<T>, companyId: string, userId: string, role: string, isPlatformAdmin: boolean, applyRateLimit = true, store?: CrmRepository, teamId?: string) {
  const firstArg = args[0] as unknown;
  const request = firstArg && typeof firstArg === "object" && "url" in firstArg && "headers" in firstArg
    ? firstArg as Request
    : undefined;
  const requestId = request?.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const started = Date.now();
  let response: Response;
  const policy = policyFor(request);
  if (applyRateLimit && policy && isDatabaseConfigured()) {
    const decision = await takeDistributedRateLimit(`${policy.bucket}:${policy.limit}/${policy.seconds}`, `${companyId}:${userId}`, policy.limit, policy.seconds);
    if (!decision.allowed) {
      response = Response.json({ error: "请求太频繁，请稍后重试", code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds), "Cache-Control": "no-store, private" } });
    } else response = await runInWorkspace({ companyId, userId, role, isPlatformAdmin, store: store ?? new CrmRepository(companyId, userId, { role, teamId }) }, () => handler(...args));
  } else {
    response = await runInWorkspace({ companyId, userId, role, isPlatformAdmin, store: store ?? new CrmRepository(companyId, userId, { role, teamId }) }, () => handler(...args));
  }
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("X-Request-Id", requestId);
  if (applyRateLimit && policy && isDatabaseConfigured()) response.headers.set("X-RateLimit-Policy", `${policy.limit};w=${policy.seconds}`);
  // Structured, privacy-minimized request telemetry. Never log query strings,
  // request bodies, email addresses, credentials, or AI prompts.
  console.info(JSON.stringify({ event: "http.request", requestId, method: request?.method || "unknown", path: request ? new URL(request.url).pathname : "unknown", status: response.status, durationMs: Date.now() - started, companyId }));
  return response;
}

export function withTenant<T extends (...args: never[]) => Promise<Response>>(handler: T): (...args: Parameters<T>) => Promise<Response> {
  return async (...args) => {
    try {
      const request = args[0] as unknown;
      if (request instanceof Request) {
        const denied = crossSiteMutation(request);
        if (denied) return denied;
      }
      const existing = currentWorkspace();
      if (existing) return await invoke(handler, args, existing.companyId, existing.userId, existing.role, existing.isPlatformAdmin, false, existing.store);
      const session = await auth();
      if (session?.user?.databaseUnavailable) throw new DatabaseUnavailableError();
      if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401 });
      if (session.user.mustChangePassword) return Response.json({ error: "首次登录请先修改临时密码" }, { status: 403 });
      let companyId = session.user.companyId;
      if (companyId === "deployment-workspace" && session.user.isPlatformAdmin === true) {
        const result = await query("SELECT id FROM companies WHERE slug=$1 AND is_active=true", [process.env.TRADEPILOT_WORKSPACE_SLUG?.trim() || "tradepilot-admin"]);
        companyId = result.rows[0]?.id;
      }
      if (!companyId || !/^[0-9a-f-]{36}$/i.test(companyId)) throw new DatabaseUnavailableError();
      const company = await query("SELECT id FROM companies WHERE id=$1 AND is_active=true", [companyId]);
      if (!company.rowCount) return Response.json({ error: "工作区已停用" }, { status: 403 });
      const actor = session.user.isPlatformAdmin === true
        ? { role: session.user.role || "owner", teamId: undefined }
        : (await query("SELECT role,settings,is_active FROM users WHERE company_id=$1 AND id=$2", [companyId, session.user.id])).rows[0];
      if (!actor || actor.is_active === false) return Response.json({ error: "账号已停用" }, { status: 403 });
      const settings = actor.settings && typeof actor.settings === "object" && !Array.isArray(actor.settings) ? actor.settings as Record<string, unknown> : {};
      const teamId = typeof settings.teamId === "string" && /^[A-Za-z0-9_.:-]{1,100}$/.test(settings.teamId) ? settings.teamId : undefined;
      const role = typeof actor.role === "string" ? actor.role : session.user.role || "member";
      return await invoke(handler, args, companyId, session.user.id, role, session.user.isPlatformAdmin === true, true, undefined, teamId);
    } catch (error) {
      if (error instanceof BillingError || error instanceof TenantAIError || error instanceof ProspectingError || error instanceof RequestBodyError || error instanceof CrmError || error instanceof DatabaseUnavailableError) return Response.json({ error: error.message, ...(error instanceof BillingError ? { code: error.code } : {}) }, { status: error.status, headers: { "Cache-Control": "no-store, private" } });
      if (error instanceof SyntaxError) return Response.json({ error: "JSON 格式不正确" }, { status: 400 });
      console.error("Tenant API request failed (details omitted)");
      return Response.json({ error: "服务暂时不可用，请稍后再试" }, { status: 503, headers: { "Cache-Control": "no-store, private" } });
    }
  };
}

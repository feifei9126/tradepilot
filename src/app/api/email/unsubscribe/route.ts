import { BillingError } from "@/lib/billing";
import { setSuppression, verifyUnsubscribeToken } from "@/lib/email/compliance";
import { isDatabaseConfigured } from "@/db";
import { takeDistributedRateLimit } from "@/lib/distributed-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };

function tokenFromRequest(request: Request, body = "") {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token")?.trim();
  if (queryToken) return queryToken;
  if (!body) return "";
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try { const value = JSON.parse(body) as { token?: unknown }; return typeof value.token === "string" ? value.token.trim() : ""; } catch { return ""; }
  }
  return new URLSearchParams(body).get("token")?.trim() || "";
}
function clientContext(request: Request) {
  return {
    ip: (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "").split(",")[0].trim().slice(0, 200),
    userAgent: (request.headers.get("user-agent") || "").slice(0, 500),
  };
}
function successResponse(request: Request) {
  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (!acceptsHtml) return Response.json({ ok: true, message: "已成功退订营销邮件" }, { headers });
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="robots" content="noindex"><title>退订成功</title><body style="font-family:system-ui,sans-serif;max-width:640px;margin:64px auto;padding:24px"><h1>退订成功</h1><p>这个邮箱以后不会再收到该工作区发送的营销邮件。</p></body></html>`, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
async function handle(request: Request, method: "GET" | "POST") {
  let body = "";
  if (method === "POST" && !new URL(request.url).searchParams.get("token")) {
    const reader = request.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = []; let size = 0;
      try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8_000) throw new BillingError("退订请求过大", 413, "UNSUBSCRIBE_BODY_TOO_LARGE"); chunks.push(value); } } finally { reader.releaseLock(); }
      body = Buffer.concat(chunks).toString("utf8");
    }
  }
  const token = tokenFromRequest(request, body);
  if (!token) throw new BillingError("退订链接缺少令牌", 400, "UNSUBSCRIBE_TOKEN_REQUIRED");
  const target = verifyUnsubscribeToken(token);
  if (method === "GET") {
    // GET is safe for mail scanners/link previews. Only POST changes consent.
    return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="robots" content="noindex"><title>确认退订</title><body><h1>退订营销邮件</h1><p>点击确认后才会退订。</p><form method="post"><button type="submit">确认退订</button></form></body></html>`, { headers: { ...headers, "Content-Type":"text/html; charset=utf-8", "Content-Security-Policy":"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "Referrer-Policy":"no-referrer" } });
  }
  if (!isDatabaseConfigured()) throw new BillingError("数据库暂时不可用，无法记录退订", 503, "DATABASE_UNAVAILABLE");
  const throttle = await takeDistributedRateLimit("email-unsubscribe:20/60", `${target.companyId}:${target.email}`, 20, 60);
  if (!throttle.allowed) throw new BillingError("退订操作过于频繁，请稍后再试", 429, "UNSUBSCRIBE_RATE_LIMITED");
  const context = clientContext(request);
  await setSuppression(target.companyId, target.email, { source: "one-click", reason: "unsubscribe", ip: context.ip, userAgent: context.userAgent });
  return successResponse(request);
}
export async function GET(request: Request) { try { return await handle(request, "GET"); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { return await handle(request, "POST"); } catch (error) { return errorResponse(error); } }
function errorResponse(error: unknown) {
  if (error instanceof BillingError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers });
  console.error("Public unsubscribe request failed (details omitted)");
  return Response.json({ error: "退订失败，请稍后重试" }, { status: 503, headers });
}

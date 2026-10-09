import { BillingError } from "@/lib/billing";
import { requestMarketingOptIn } from "@/lib/email/opt-in";
import { confirmMarketingConsent } from "@/lib/email/compliance";
import { boundedText } from "@/lib/request-json";
import { crossSiteMutation } from "@/lib/request-security";
import { takeDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { loginClientIdentity } from "@/lib/login-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control":"no-store, private", "X-Content-Type-Options":"nosniff", "Referrer-Policy":"no-referrer", "Content-Security-Policy":"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };
export async function GET(request: Request) {
  const url = new URL(request.url), token = url.searchParams.get("token"), company = url.searchParams.get("workspace") || "";
  if (!token && !/^[0-9a-f-]{36}$/i.test(company)) return Response.json({ error:"缺少有效工作区" },{ status:400,headers });
  const form = token ? '<p>确认后将订阅该工作区的营销邮件；以后可随时退订。</p><button>确认订阅</button>' : `<input type="hidden" name="workspace" value="${company}"><label>你的邮箱<input type="email" name="email" required maxlength="320"></label><p>提交后我们会发送确认邮件；未确认不会订阅。</p><button>发送确认邮件</button>`;
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="robots" content="noindex"><title>邮件订阅</title><body><h1>邮件订阅</h1><form method="post">${form}</form></body></html>`,{ headers:{ ...headers,"Content-Type":"text/html; charset=utf-8" } });
}
export async function POST(request: Request) {
  const denied = crossSiteMutation(request); if (denied) return denied;
  try {
    const throttle = await takeDistributedRateLimit("consent-public-ip",loginClientIdentity(request),30,60);
    if (!throttle.allowed) throw new BillingError("请求过于频繁",429,"CONSENT_RATE_LIMITED");
    const body = new URLSearchParams(await boundedText(request,4_000));
    const token = new URL(request.url).searchParams.get("token");
    const result = token ? await confirmMarketingConsent(token) : await requestMarketingOptIn(body.get("workspace") || "",body.get("email") || "");
    if (request.headers.get("accept")?.includes("text/html")) return new Response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>申请成功</title><body><h1>操作成功</h1><p>若刚提交邮箱，请查看确认邮件并点击确认；若已确认链接，订阅已生效。</p></body></html>',{ headers:{ ...headers,"Content-Type":"text/html; charset=utf-8" } });
    return Response.json(result,{ headers });
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ error:error.message,code:error.code },{ status:error.status,headers });
    return Response.json({ error:"订阅服务暂时不可用，请稍后重试" },{ status:503,headers });
  }
}

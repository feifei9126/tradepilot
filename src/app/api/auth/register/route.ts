import { NextResponse } from "next/server";
import { z } from "zod";
import { DatabaseUnavailableError, isDatabaseConfigured } from "@/db";
import { boundedJson, RequestBodyError } from "@/lib/request-json";
import { crossSiteMutation } from "@/lib/request-security";
import { takeDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { loginClientIdentity } from "@/lib/login-security";
import { createUser } from "@/lib/registration";
import { isRegistrationPasswordAllowed, selfRegistrationEnabled } from "@/lib/registration-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const inputSchema = z.object({
  company: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  password: z.string().refine(isRegistrationPasswordAllowed, "密码需为 12–128 位，至少包含两类字符且避免过于简单"),
}).strict();

export async function GET() {
  const enabled = selfRegistrationEnabled() && isDatabaseConfigured();
  return NextResponse.json({
    enabled,
    reason: enabled ? undefined : selfRegistrationEnabled() ? "注册服务暂不可用" : "当前未开放自助注册",
  }, { headers });
}

export async function POST(request: Request) {
  if (!selfRegistrationEnabled()) {
    return NextResponse.json({ error: "当前未开放自助注册" }, { status: 403, headers });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "注册服务暂不可用，请稍后重试" }, { status: 503, headers });
  }
  const denied = crossSiteMutation(request);
  if (denied) return denied;

  try {
    const peerLimit = await takeDistributedRateLimit("public-registration-ip", loginClientIdentity(request), 30, 60 * 60);
    if (!peerLimit.allowed) {
      return NextResponse.json({ error: "注册请求过于频繁，请稍后重试" }, {
        status: 429,
        headers: { ...headers, "Retry-After": String(peerLimit.retryAfterSeconds) },
      });
    }

    const parsed = inputSchema.safeParse(await boundedJson(request, 8_000));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "注册信息格式不正确" }, { status: 400, headers });
    }
    const email = parsed.data.email.toLowerCase();
    const emailLimit = await takeDistributedRateLimit("public-registration-email", email, 5, 24 * 60 * 60);
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: "该邮箱的注册请求过于频繁，请 24 小时后重试" }, {
        status: 429,
        headers: { ...headers, "Retry-After": String(emailLimit.retryAfterSeconds) },
      });
    }

    const result = await createUser(parsed.data.company, parsed.data.name, email, parsed.data.password);
    if (!result.ok) {
      const duplicate = result.error === "该邮箱已被注册";
      const invalid = result.error === "注册信息格式不正确";
      return NextResponse.json({ error: result.error }, { status: duplicate ? 409 : invalid ? 400 : 503, headers });
    }
    return NextResponse.json({ ok: true }, { status: 201, headers });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: "注册服务暂不可用，请稍后重试" }, { status: 503, headers });
    return NextResponse.json({ error: "注册服务暂不可用，请稍后重试" }, { status: 503, headers });
  }
}

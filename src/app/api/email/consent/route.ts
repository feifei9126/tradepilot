import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/tenant-route";
import { currentWorkspace } from "@/lib/workspace-context";
import { boundedJson } from "@/lib/request-json";
import { BillingError } from "@/lib/billing";
import { marketingSubscriptionUrl } from "@/lib/email/opt-in";
import { recordMarketingConsent } from "@/lib/email/compliance";

const schema = z.object({ email: z.string().trim().email().max(320), subscribed: z.boolean(), source: z.string().trim().max(80).optional() }).strict();
async function handleGET() {
  const workspace = currentWorkspace()!;
  return NextResponse.json({ subscribeUrl: marketingSubscriptionUrl(workspace.companyId) });
}

async function handlePOST(request: Request) {
  const workspace = currentWorkspace();
  if (!workspace) throw new BillingError("请先登录", 401, "AUTH_REQUIRED");
  const parsed = schema.safeParse(await boundedJson(request, 4_000));
  if (!parsed.success) throw new BillingError("邮箱或订阅状态格式不正确", 400, "CONSENT_INPUT_INVALID");
  await recordMarketingConsent(workspace.companyId, parsed.data.email, { subscribed: parsed.data.subscribed, source: parsed.data.source || "workspace", ip: request.headers.get("x-forwarded-for") || "", userAgent: request.headers.get("user-agent") || "" });
  return NextResponse.json({ ok: true, email: parsed.data.email.toLowerCase(), subscribed: parsed.data.subscribed });
}
export const POST = withTenant(handlePOST);

export const GET = withTenant(handleGET);

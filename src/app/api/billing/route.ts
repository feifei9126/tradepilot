import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/tenant-route";
import { currentWorkspace } from "@/lib/workspace-context";
import { BillingError, createCheckoutSession, getBillingSummary } from "@/lib/billing";

export const runtime = "nodejs";
const checkoutSchema = z.object({ action: z.literal("checkout"), planId: z.string().regex(/^[a-z0-9-]{1,40}$/), interval: z.enum(["month", "year"]), billingEmail: z.string().email().max(320) }).strict();

async function handleGET() {
  const workspace = currentWorkspace();
  if (!workspace) throw new BillingError("工作区上下文不存在", 500);
  return NextResponse.json(await getBillingSummary(workspace.companyId));
}

async function handlePOST(req: Request) {
  const workspace = currentWorkspace();
  if (!workspace || !["owner", "admin"].includes(workspace.role)) throw new BillingError("仅工作区所有者或管理员可以管理订阅", 403);
  const payload = checkoutSchema.safeParse(await req.json());
  if (!payload.success) throw new BillingError("套餐、计费周期或账单邮箱格式不正确", 400);
  const session = await createCheckoutSession(workspace.companyId, payload.data.billingEmail, payload.data.planId, payload.data.interval);
  return NextResponse.json({ ok: true, checkoutUrl: session.url, sessionId: session.id });
}

export const GET = withTenant(handleGET);
export const POST = withTenant(handlePOST);

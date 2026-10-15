import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/tenant-route";
import { currentWorkspace } from "@/lib/workspace-context";
import { CrmError } from "@/lib/crm-repository";
import { boundedJson } from "@/lib/request-json";
import { syncTenantMailbox } from "@/lib/email/imap";
import { BillingError } from "@/lib/billing";

export const runtime = "nodejs";
const schema = z.object({ accountId: z.string().trim().min(1).max(240), folder: z.string().trim().min(1).max(100).default("INBOX"), limit: z.number().int().min(1).max(100).default(50) }).strict();
async function handlePOST(request: Request) {
  const workspace = currentWorkspace();
  if (!workspace || !["owner", "admin"].includes(workspace.role)) throw new CrmError("仅工作区所有者或管理员可以同步邮箱", 403);
  const parsed = schema.safeParse(await boundedJson(request, 8_000));
  if (!parsed.success) throw new CrmError("邮箱账号、文件夹或同步数量格式不正确");
  try {
    return NextResponse.json({ ok: true, result: await syncTenantMailbox(workspace.companyId, parsed.data.accountId, parsed.data.folder, parsed.data.limit) });
  } catch (error) {
    if (error instanceof BillingError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}
export const POST = withTenant(handlePOST);

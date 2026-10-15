import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/tenant-route";
import { currentWorkspace } from "@/lib/workspace-context";
import { CrmError } from "@/lib/crm-repository";
import { testImapConnection } from "@/lib/email/imap";
import { markEmailConnectionTest } from "@/lib/email/credentials";
import { testSmtpConnection } from "@/lib/email/smtp";

export const runtime = "nodejs";
const schema = z.object({ accountId: z.string().min(1).max(240), protocol: z.enum(["smtp", "imap"]) }).strict();
async function handlePOST(req: Request) {
  const workspace = currentWorkspace();
  if (!workspace || !["owner", "admin"].includes(workspace.role)) throw new CrmError("仅工作区所有者或管理员可以测试邮箱连接", 403);
  const parsed = schema.safeParse(await req.json()); if (!parsed.success) throw new CrmError("邮箱账号或协议无效");
  try {
    if (parsed.data.protocol === "smtp") await testSmtpConnection(workspace.companyId, parsed.data.accountId);
    else await testImapConnection(workspace.companyId, parsed.data.accountId);
    await markEmailConnectionTest(workspace.companyId, parsed.data.accountId, parsed.data.protocol);
    return NextResponse.json({ ok: true, protocol: parsed.data.protocol, message: `${parsed.data.protocol.toUpperCase()} 连接成功` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "连接失败";
    await markEmailConnectionTest(workspace.companyId, parsed.data.accountId, parsed.data.protocol, message).catch(() => {});
    throw error;
  }
}
export const POST = withTenant(handlePOST);

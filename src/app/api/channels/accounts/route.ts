import { withTenant } from "@/lib/tenant-route";
import { getStore, currentWorkspace } from "@/lib/workspace-context";
import { boundedJson } from "@/lib/request-json";
import {
  listChannelAccounts,
  saveChannelAccount,
} from "@/lib/messaging/accounts";
import { ChannelError } from "@/lib/messaging/types";
export const runtime = "nodejs";
async function handleGET() {
  return Response.json({
    accounts: await listChannelAccounts(getStore().companyId),
    canManage: ["owner", "admin", "platform-admin"].includes(
      currentWorkspace()?.role || "",
    ),
  });
}
async function handlePOST(request: Request) {
  const body = await boundedJson(request, 24_000);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ChannelError("渠道配置格式无效", 400);
  return Response.json(
    { account: await saveChannelAccount(body as Record<string, unknown>) },
    { status: 200 },
  );
}
export const GET = withTenant(handleGET);
export const POST = withTenant(handlePOST);

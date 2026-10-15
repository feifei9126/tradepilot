import { withTenant } from "@/lib/tenant-route";
import { currentWorkspace } from "@/lib/workspace-context";
import { boundedJson, mutationOrigin } from "@/lib/api-config/access";
import { getTenantWebhookCredential, rotateTenantWebhookCredential, TenantWebhookError } from "@/lib/tenant-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
async function handleGET() {
  const workspace = currentWorkspace();
  if (!workspace) return Response.json({ error: "请先登录" }, { status: 401, headers });
  if (!["owner", "admin"].includes(workspace.role)) return Response.json({ error: "仅工作区所有者或管理员可查看 Webhook 状态" }, { status: 403, headers });
  const credential = await getTenantWebhookCredential(workspace.companyId);
  return Response.json(credential, { headers });
}
async function handlePOST(request: Request) {
  const denied = mutationOrigin(request);
  if (denied) return denied;
  const workspace = currentWorkspace();
  if (!workspace) return Response.json({ error: "请先登录" }, { status: 401, headers });
  try {
    const body = await boundedJson(request, 1024);
    if (!body || typeof body !== "object" || Array.isArray(body) || (body as { action?: unknown }).action !== "rotate") return Response.json({ error: "只支持 action=rotate" }, { status: 400, headers });
    return Response.json(await rotateTenantWebhookCredential(workspace.companyId, workspace.userId), { headers });
  } catch (error) {
    if (error instanceof TenantWebhookError) return Response.json({ error: error.message }, { status: error.status, headers });
    throw error;
  }
}
export const GET = withTenant(handleGET);
export const POST = withTenant(handlePOST);

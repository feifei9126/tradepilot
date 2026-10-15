import { withTenant } from "@/lib/tenant-route";
import { currentWorkspace } from "@/lib/workspace-context";
import { boundedJson, mutationOrigin } from "@/lib/api-config/access";
import { getTenantAISettings, getTenantAIUsage, saveTenantAISettings, TenantAIError } from "@/lib/tenant-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

async function handleGET() {
  const workspace = currentWorkspace();
  if (!workspace) return Response.json({ error: "请先登录" }, { status: 401, headers });
  if (!["owner", "admin"].includes(workspace.role)) return Response.json({ error: "仅工作区所有者或管理员可查看 AI 用量" }, { status: 403, headers });
  const [settings, usage] = await Promise.all([getTenantAISettings(workspace.companyId), getTenantAIUsage(workspace.companyId)]);
  return Response.json({ settings, usage }, { headers });
}

async function handlePUT(request: Request) {
  const denied = mutationOrigin(request);
  if (denied) return denied;
  const workspace = currentWorkspace();
  if (!workspace) return Response.json({ error: "请先登录" }, { status: 401, headers });
  if (!["owner", "admin"].includes(workspace.role)) return Response.json({ error: "仅工作区所有者或管理员可以管理 AI 配置" }, { status: 403, headers });
  try {
    const input = await boundedJson(request, 16000);
    const settings = await saveTenantAISettings(workspace.companyId, workspace.userId, input);
    return Response.json({ settings, usage: await getTenantAIUsage(workspace.companyId) }, { headers });
  } catch (error) {
    if (error instanceof TenantAIError) return Response.json({ error: error.message }, { status: error.status, headers });
    throw error;
  }
}
export const GET = withTenant(handleGET);
export const PUT = withTenant(handlePUT);

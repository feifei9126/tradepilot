import { readAPIConfig } from "@/lib/api-config/store";
import { textReady, voiceKey } from "@/lib/api-config/schema";
import { getTenantAIReadiness } from "@/lib/tenant-ai";
import { withTenant } from "@/lib/tenant-route";
import { currentWorkspace } from "@/lib/workspace-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handleGET() {
  const workspace = currentWorkspace()!;
  if (!workspace.isPlatformAdmin) {
    return Response.json({ ...await getTenantAIReadiness(workspace.companyId), voiceReady: false });
  }
  const c = readAPIConfig();
  const ready = textReady(c);
  return Response.json({
    textReady: ready,
    scope: "platform",
    configurationUrl: "/app/api-config",
    unavailableReason: ready ? "" : "请先在 API 配置中心配置文本模型",
    voiceReady: Boolean(c.livekit.url && c.livekit.apiKey && c.livekit.apiSecret && voiceKey(c)),
    tasks: c.tasks,
    provider: c.text.provider,
    model: c.text.model,
  });
}
export const GET = withTenant(handleGET);

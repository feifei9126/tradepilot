import { auth } from "@/lib/auth";
import { configAccess } from "@/lib/api-config/access";
import { readAPIConfig, serviceEnvironment } from "@/lib/api-config/store";
import { voiceKey } from "@/lib/api-config/schema";
import { createSessionResponse, livekitConfig } from "@/lib/livekit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const denied = await configAccess(); if (denied) return denied;
  try {
    const config = livekitConfig(serviceEnvironment());
    const voiceConfigured = Boolean(voiceKey(readAPIConfig()));
    return Response.json({ ...config, configured: config.configured && voiceConfigured, voiceConfigured, workerStatus: "unknown" }, { headers: { "Cache-Control": "no-store, private" } });
  } catch { return Response.json({error:"API 配置读取失败"}, {status:503}); }
}
export async function POST(request: Request) {
  const denied = await configAccess(); if (denied) return denied;
  try {
    if (!voiceKey(readAPIConfig())) return Response.json({error:"请在 API 配置中心设置 OpenAI 语音密钥"}, {status:503});
    const session = await auth();
    return createSessionResponse(request, session?.user?.id, serviceEnvironment());
  } catch { return Response.json({error:"API 配置读取失败"}, {status:503}); }
}

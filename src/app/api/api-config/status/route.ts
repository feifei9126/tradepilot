import { configAccess } from "@/lib/api-config/access";
import { readAPIConfig } from "@/lib/api-config/store";
import { textReady, voiceKey } from "@/lib/api-config/schema";
export const dynamic = "force-dynamic";
export async function GET() {
  const denied = await configAccess();
  if (denied) return denied;
  try {
    const c = readAPIConfig();
    return Response.json(
      {
        textReady: textReady(c),
        voiceReady: Boolean(
          c.livekit.url &&
          c.livekit.apiKey &&
          c.livekit.apiSecret &&
          voiceKey(c),
        ),
        tasks: c.tasks,
        provider: c.text.provider,
        model: c.text.model,
      },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch {
    return Response.json({ error: "API 配置不可用" }, { status: 503 });
  }
}

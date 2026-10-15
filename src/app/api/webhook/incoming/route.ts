import { TenantWebhookError, recordIncomingTenantWebhook } from "@/lib/tenant-webhook";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Webhook 请求体为空" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64_000) {
        await reader.cancel().catch(() => {});
        return NextResponse.json({ error: "Webhook 请求体超过 64 KB" }, { status: 413, headers: { "Cache-Control": "no-store" } });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const result = await recordIncomingTenantWebhook({
      slug: request.headers.get("x-tradepilot-workspace") || "",
      eventId: request.headers.get("x-tradepilot-event-id") || "",
      timestamp: request.headers.get("x-tradepilot-timestamp") || "",
      signature: request.headers.get("x-tradepilot-signature") || "",
      body: Buffer.concat(chunks),
    });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 202, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof TenantWebhookError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store, private" } });
    console.error("Tenant webhook failed (details omitted)");
    return NextResponse.json({ error: "Webhook 暂时不可用" }, { status: 503, headers: { "Cache-Control": "no-store, private" } });
  }
}

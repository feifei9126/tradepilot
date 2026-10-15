import { channelWebhook } from "@/lib/messaging/webhooks";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  return channelWebhook(request, (await context.params).accountId, "wechat");
}
export { handle as GET, handle as POST };

import { withTenant } from "@/lib/tenant-route";
import { boundedJson } from "@/lib/request-json";
import { sendChannelReply } from "@/lib/messaging/sending";
import { ChannelError } from "@/lib/messaging/types";
export const runtime = "nodejs";
async function handlePOST(request: Request) {
  const body = (await boundedJson(request, 20_000)) as Record<string, unknown>;
  if (
    !body ||
    typeof body.replyToMessageId !== "string" ||
    typeof body.content !== "string" ||
    typeof body.idempotencyKey !== "string"
  )
    throw new ChannelError("原始消息、回复内容和幂等标识必填", 400);
  return Response.json(
    await sendChannelReply({
      replyToMessageId: body.replyToMessageId,
      content: body.content.trim(),
      idempotencyKey: body.idempotencyKey,
    }),
  );
}
export const POST = withTenant(handlePOST);

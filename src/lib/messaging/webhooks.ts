import { DatabaseUnavailableError } from "@/db";
import { CrmRepository } from "@/lib/crm-repository";
import { boundedBytes, RequestBodyError } from "@/lib/request-json";
import { takeDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { accountSecrets, findChannelAccount } from "./accounts";
import { recordChannelEvents } from "./inbox";
import {
  constantEqual,
  verifyWechatChallenge,
  verifyWechatMessage,
  verifyWhatsappSignature,
  parseWhatsappEvents,
} from "./protocol";
import { ChannelError, type MessagingChannel } from "./types";

export async function channelWebhook(
  request: Request,
  id: string,
  channel: MessagingChannel,
) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
  };
  try {
    const account = await findChannelAccount(id, undefined, channel);
    if (!account.enabled) throw new ChannelError("消息渠道已停用", 409);
    const secrets = accountSecrets(account);
    const url = new URL(request.url);
    if (request.method === "GET") {
      let challenge: string;
      if (channel === "wechat")
        challenge = verifyWechatChallenge(url, secrets, account.config.appId);
      else {
        challenge = url.searchParams.get("hub.challenge") || "";
        if (
          url.searchParams.get("hub.mode") !== "subscribe" ||
          !/^\d{1,1000}$/.test(challenge) ||
          !constantEqual(
            url.searchParams.get("hub.verify_token") || "",
            secrets.verifyToken,
          )
        )
          throw new ChannelError("WhatsApp 回调验证失败", 401);
      }
      await new CrmRepository(account.company_id, "system").write(
        async (client) => {
          const verified = await client.query(
            "UPDATE messaging_accounts SET last_verified_at=now(),last_error=NULL WHERE id=$1 AND company_id=$2 AND enabled=true AND secrets_ciphertext=$3 RETURNING id",
            [id, account.company_id, account.secrets_ciphertext],
          );
          if (!verified.rowCount)
            throw new ChannelError("消息渠道已停用或凭据已更新", 409);
        },
      );
      return new Response(challenge, { headers });
    }
    const body = await boundedBytes(request, 256_000);
    let events;
    if (channel === "wechat")
      events = verifyWechatMessage(url, body, account, secrets);
    else {
      verifyWhatsappSignature(
        body,
        request.headers.get("x-hub-signature-256") || "",
        secrets.appSecret,
      );
      events = parseWhatsappEvents(body, account.config);
    }
    const decision = await takeDistributedRateLimit(
      "messaging-webhook:600/60",
      account.id,
      600,
      60,
    );
    if (!decision.allowed)
      return new Response("回调请求太频繁，请重试", {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(decision.retryAfterSeconds),
        },
      });
    await recordChannelEvents(account, events);
    return new Response(channel === "wechat" ? "success" : "EVENT_RECEIVED", {
      headers,
    });
  } catch (error) {
    const safe =
      error instanceof ChannelError ||
      error instanceof RequestBodyError ||
      error instanceof DatabaseUnavailableError;
    return new Response(safe ? error.message : "消息回调暂时不可用", {
      status: safe ? error.status : 503,
      headers,
    });
  }
}

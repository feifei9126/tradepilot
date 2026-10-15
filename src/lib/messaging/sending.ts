import { randomUUID } from "node:crypto";
import { getStore } from "@/lib/workspace-context";
import type { StoredMessage } from "@/lib/store";
import { CrmRepository } from "@/lib/crm-repository";
import { findChannelAccount } from "./accounts";
import { applyDeliveryEvent, digest } from "./inbox";
import { sendProviderText, ProviderError } from "./providers";
import {
  ChannelError,
  type DeliveryEvent,
  type DeliveryStatus,
  type ChannelAccount,
} from "./types";

export function requireReplyWindow(
  account: ChannelAccount,
  message: StoredMessage,
  now = Date.now(),
) {
  const age = now - Date.parse(message.createdAt);
  const hours = account.channel === "wechat" ? 48 : 24;
  if (
    !Number.isFinite(age) ||
    age < -600_000 ||
    age > hours * 3600_000 ||
    message.messageType === "event.unsubscribe"
  )
    throw new ChannelError(
      `客户服务回复窗口已关闭；${account.channel === "wechat" ? "微信服务号需在用户互动后 48 小时内回复" : "WhatsApp 需在用户发消息后 24 小时内回复，超过窗口请使用获批模板"}`,
      409,
    );
}
export async function sendChannelReply(
  input: { replyToMessageId: string; content: string; idempotencyKey: string },
  send = sendProviderText,
) {
  const repository = getStore();
  if (
    !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(input.idempotencyKey) ||
    !input.content ||
    input.content.length > 4096
  )
    throw new ChannelError("回复内容或幂等标识无效", 400);
  const original = await repository.messages.get(input.replyToMessageId);
  if (
    !original?.channelAccountId ||
    !original.peerId ||
    original.direction !== "in"
  )
    throw new ChannelError("原始渠道消息不存在或无权访问", 404);
  const account = await findChannelAccount(
    original.channelAccountId,
    repository.companyId,
  );
  if (!account.enabled) throw new ChannelError("消息渠道已停用", 409);
  if (account.channel === "wechat" && Buffer.byteLength(input.content) > 2048)
    throw new ChannelError("微信文字回复不能超过 2048 字节", 400);
  const hash = digest(
    JSON.stringify([account.id, original.peerId, input.content]),
  );
  const reservation = await repository.write(async (client) => {
    const prior = await client.query(
      "SELECT * FROM messaging_outbound WHERE company_id=$1 AND idempotency_key=$2",
      [repository.companyId, input.idempotencyKey],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].content_sha256 !== hash)
        throw new ChannelError("该幂等标识已用于另一条回复", 409);
      const message = await repository.read<StoredMessage>(
        "messages",
        prior.rows[0].message_id,
        client,
      );
      if (!message) throw new ChannelError("回复不存在或无权访问", 404);
      return { message, reused: true, deliveryId: prior.rows[0].id as string };
    }
    // Recheck customer ACL and newest inbound while holding the workspace write lock.
    if (!(await repository.read("messages", original.id, client)))
      throw new ChannelError("原始消息不存在或无权访问", 404);
    const active = await client.query(
      "SELECT enabled FROM messaging_accounts WHERE company_id=$1 AND id=$2 FOR SHARE",
      [repository.companyId, account.id],
    );
    if (!active.rows[0]?.enabled) throw new ChannelError("消息渠道已停用", 409);
    const latest = await client.query(
      `SELECT data FROM crm_records WHERE company_id=$1 AND kind='messages' AND data->>'channelAccountId'=$2 AND data->>'peerId'=$3 AND data->>'direction'='in' ORDER BY data->>'createdAt' DESC LIMIT 1`,
      [repository.companyId, account.id, original.peerId],
    );
    requireReplyWindow(account, latest.rows[0]?.data || original);
    const deliveryId = randomUUID();
    const message: StoredMessage = {
      id: `m_${deliveryId}`,
      contactId: original.contactId,
      contactName: original.contactName,
      channel: account.channel,
      channelAccountId: account.id,
      peerId: original.peerId,
      content: input.content,
      direction: "out",
      read: true,
      deliveryStatus: "sending",
      messageType: "text",
      createdAt: new Date().toISOString(),
    };
    await repository.save(client, "messages", message, true);
    await client.query(
      `INSERT INTO messaging_outbound(id,company_id,account_id,idempotency_key,content_sha256,peer_id,message_id,status) VALUES($1,$2,$3,$4,$5,$6,$7,'sending')`,
      [
        deliveryId,
        repository.companyId,
        account.id,
        input.idempotencyKey,
        hash,
        original.peerId,
        message.id,
      ],
    );
    await repository.auditIn(client, "messaging.reply.requested", message.id, {
      accountId: account.id,
      channel: account.channel,
    });
    return { message, reused: false, deliveryId };
  });
  if (reservation.reused) return { message: reservation.message, reused: true };
  let providerId: string | null = null,
    status: DeliveryStatus = "sent",
    errorCode: string | null = null,
    deliveryError: string | undefined;
  try {
    providerId = await send(account, original.peerId, input.content);
  } catch (error) {
    status =
      error instanceof ProviderError && !error.uncertain ? "failed" : "unknown";
    errorCode = error instanceof ProviderError ? error.code : "uncertain";
    deliveryError =
      error instanceof ChannelError
        ? error.message
        : "平台结果待核实，请勿直接重复发送";
  }
  // Finish independently of the original actor/ACL: the platform action has already happened.
  const system = new CrmRepository(repository.companyId, "system");
  const message = await system.write(async (client) => {
    const current = await system.read<StoredMessage>(
      "messages",
      reservation.message.id,
      client,
    );
    if (!current)
      throw new ChannelError("发送结果记录不可用，请核实平台结果", 503);
    const updated = {
      ...current,
      providerMessageId: providerId || undefined,
      deliveryStatus: status,
      deliveryError,
    };
    await system.save(client, "messages", updated, false);
    await client.query(
      "UPDATE messaging_outbound SET status=$3,provider_message_id=$4,error_code=$5,updated_at=now() WHERE company_id=$1 AND id=$2",
      [
        repository.companyId,
        reservation.deliveryId,
        status,
        providerId,
        errorCode,
      ],
    );
    if (providerId) {
      // Webhook delivery receipts may arrive before the sending API returns.
      const pending = await client.query(
        `SELECT details FROM messaging_events WHERE account_id=$1 AND details->>'providerId'=$2 ORDER BY received_at`,
        [account.id, providerId],
      );
      for (const row of pending.rows)
        await applyDeliveryEvent(
          client,
          system,
          account.id,
          row.details as DeliveryEvent,
        );
    }
    await system.auditIn(client, `messaging.reply.${status}`, updated.id, {
      accountId: account.id,
      errorCode,
    });
    return (await system.read<StoredMessage>("messages", updated.id, client))!;
  });
  return { message, reused: false };
}

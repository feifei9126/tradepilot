import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { CrmRepository } from "@/lib/crm-repository";
import type { StoredMessage, StoredContact } from "@/lib/store";
import {
  ChannelError,
  type ChannelAccount,
  type ChannelEvent,
  type DeliveryEvent,
  type DeliveryStatus,
} from "./types";
export const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export function nextDeliveryStatus(
  current: DeliveryStatus,
  incoming: DeliveryStatus,
): DeliveryStatus {
  const rank = {
    sending: 0,
    unknown: 0,
    sent: 1,
    failed: 2,
    delivered: 3,
    read: 4,
  };
  return rank[incoming] > rank[current] ? incoming : current;
}
export async function applyDeliveryEvent(
  client: PoolClient,
  repository: CrmRepository,
  accountId: string,
  event: DeliveryEvent,
) {
  const rows = await client.query(
    "SELECT * FROM messaging_outbound WHERE company_id=$1 AND account_id=$2 AND provider_message_id=$3 FOR UPDATE",
    [repository.companyId, accountId, event.providerId],
  );
  for (const row of rows.rows) {
    const status = nextDeliveryStatus(row.status, event.status);
    const message = await repository.read<StoredMessage>(
      "messages",
      row.message_id,
      client,
    );
    if (!message) continue;
    await client.query(
      "UPDATE messaging_outbound SET status=$3,error_code=$4,updated_at=now() WHERE company_id=$1 AND id=$2",
      [
        repository.companyId,
        row.id,
        status,
        status === "failed" ? event.errorCode || "provider_failed" : null,
      ],
    );
    await repository.save(
      client,
      "messages",
      {
        ...message,
        deliveryStatus: status,
        deliveryError:
          status === "failed"
            ? `平台错误 ${event.errorCode || "unknown"}`
            : undefined,
      },
      false,
    );
  }
}
export async function recordChannelEvents(
  account: ChannelAccount,
  events: ChannelEvent[],
) {
  const repository = new CrmRepository(account.company_id, "system");
  return repository.write(async (client) => {
    const active = await client.query(
      "SELECT enabled,secrets_ciphertext FROM messaging_accounts WHERE id=$1 AND company_id=$2 FOR SHARE",
      [account.id, account.company_id],
    );
    if (
      !active.rows[0]?.enabled ||
      active.rows[0].secrets_ciphertext !== account.secrets_ciphertext
    )
      throw new ChannelError("消息渠道已停用或凭据已更新", 409);
    let accepted = 0;
    for (const event of events) {
      // Stable across envelope retries; display-name changes do not alter a message's identity.
      const payloadHash = digest(
        JSON.stringify({
          ...event,
          ...(event.type === "message" ? { peerName: undefined } : {}),
        }),
      );
      const inserted = await client.query(
        `INSERT INTO messaging_events(company_id,account_id,event_id,payload_sha256,details) VALUES($1,$2,$3,$4,$5::jsonb)
        ON CONFLICT(account_id,event_id) DO NOTHING RETURNING event_id`,
        [
          account.company_id,
          account.id,
          event.eventId,
          payloadHash,
          JSON.stringify(event.type === "status" ? event : {}),
        ],
      );
      if (!inserted.rowCount) {
        const prior = await client.query(
          "SELECT payload_sha256 FROM messaging_events WHERE account_id=$1 AND event_id=$2",
          [account.id, event.eventId],
        );
        if (prior.rows[0]?.payload_sha256 !== payloadHash)
          throw new ChannelError("重复消息的内容发生冲突", 409);
        continue;
      }
      if (event.type === "status")
        await applyDeliveryEvent(client, repository, account.id, event);
      else {
        const contactId = `c_msg_${digest(`${account.id}:${event.peerId}`).slice(0, 40)}`;
        let contact = await repository.read<StoredContact>(
          "contacts",
          contactId,
          client,
        );
        if (!contact) {
          contact = {
            id: contactId,
            name: event.peerName,
            source: account.channel === "wechat" ? "微信服务号" : "WhatsApp",
            tags: [account.channel],
            phone:
              account.channel === "whatsapp" ? `+${event.peerId}` : undefined,
            visibility: "workspace",
            createdAt: event.timestamp,
          };
          await repository.save(client, "contacts", contact, true);
        }
        const message: StoredMessage = {
          id: `m_channel_${digest(`${account.id}:${event.eventId}`).slice(0, 40)}`,
          contactId,
          contactName: contact.name,
          channel: account.channel,
          channelAccountId: account.id,
          peerId: event.peerId,
          providerMessageId: event.eventId.slice(8),
          messageType: event.messageType,
          content: event.content,
          direction: "in",
          read: false,
          createdAt: event.timestamp,
        };
        await repository.save(client, "messages", message, true);
      }
      accepted++;
    }
    await client.query(
      "UPDATE messaging_accounts SET last_received_at=now(),last_error=NULL WHERE id=$1 AND company_id=$2",
      [account.id, account.company_id],
    );
    if (accepted)
      await repository.auditIn(
        client,
        "messaging.webhook.accepted",
        account.id,
        { channel: account.channel, events: accepted },
      );
    return { accepted, duplicates: events.length - accepted };
  });
}

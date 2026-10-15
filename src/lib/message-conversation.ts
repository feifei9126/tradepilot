import type { StoredMessage } from "./store";
export function messageConversationKey(message: StoredMessage) {
  return JSON.stringify(
    message.channelAccountId && message.peerId
      ? [message.channel, message.channelAccountId, message.peerId]
      : ["internal", message.channel, message.contactName],
  );
}
export const DELIVERY_LABELS = {
  sending: "正在发送",
  sent: "平台已接受",
  delivered: "已送达",
  read: "对方已读",
  failed: "发送失败",
  unknown: "结果待核实",
};

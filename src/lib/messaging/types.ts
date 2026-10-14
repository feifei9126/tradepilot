import { CrmError } from "@/lib/crm-repository";

export type MessagingChannel = "wechat" | "whatsapp";
export type DeliveryStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "unknown";
export class ChannelError extends CrmError {}
export type ChannelAccount = {
  id: string;
  company_id: string;
  channel: MessagingChannel;
  name: string;
  config: Record<string, string>;
  secrets_ciphertext: string;
  enabled: boolean;
};
export type ChannelSecrets = {
  verifyToken: string;
  appSecret: string;
  aesKey?: string;
  accessToken?: string;
};
export type IncomingMessage = {
  type: "message";
  eventId: string;
  peerId: string;
  peerName: string;
  content: string;
  messageType: string;
  timestamp: string;
};
export type DeliveryEvent = {
  type: "status";
  eventId: string;
  providerId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errorCode?: string;
};
export type ChannelEvent = IncomingMessage | DeliveryEvent;
export type PublicChannelAccount = {
  id: string;
  channel: MessagingChannel;
  name: string;
  config: Record<string, string>;
  enabled: boolean;
  callbackUrl: string;
  publicCallbackReady: boolean;
  lastVerifiedAt: string | null;
  lastReceivedAt: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  hasAppSecret: boolean;
  hasAccessToken: boolean;
};

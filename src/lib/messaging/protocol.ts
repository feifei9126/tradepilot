import {
  createDecipheriv,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  ChannelError,
  type ChannelEvent,
  type ChannelSecrets,
  type ChannelAccount,
} from "./types";

export function constantEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function wechatSignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypted: string,
) {
  return createHash("sha1")
    .update([token, timestamp, nonce, encrypted].sort().join(""))
    .digest("hex");
}
function validWechatQuery(url: URL) {
  const timestamp = url.searchParams.get("timestamp") || "";
  const nonce = url.searchParams.get("nonce") || "";
  if (
    !/^\d{10}$/.test(timestamp) ||
    !/^[\w-]{1,100}$/.test(nonce) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 600
  )
    throw new ChannelError("微信回调时间或随机串无效", 401);
  return { timestamp, nonce };
}
export function decryptWechat(
  encrypted: string,
  aesKey: string,
  appId: string,
) {
  try {
    if (
      !/^[A-Za-z0-9+/]{43}$/.test(aesKey) ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encrypted) ||
      encrypted.length % 4
    )
      throw new Error();
    const key = Buffer.from(`${aesKey}=`, "base64");
    const cipher = Buffer.from(encrypted, "base64");
    if (key.length !== 32 || !cipher.length || cipher.length % 16)
      throw new Error();
    const decipher = createDecipheriv("aes-256-cbc", key, key.subarray(0, 16));
    decipher.setAutoPadding(false);
    const padded = Buffer.concat([decipher.update(cipher), decipher.final()]);
    const count = padded[padded.length - 1];
    if (
      count < 1 ||
      count > 32 ||
      count > padded.length ||
      !padded.subarray(-count).every((value) => value === count)
    )
      throw new Error();
    const bytes = padded.subarray(0, -count);
    if (bytes.length < 20) throw new Error();
    const length = bytes.readUInt32BE(16);
    if (
      length > bytes.length - 20 ||
      !constantEqual(bytes.subarray(20 + length).toString("utf8"), appId)
    )
      throw new Error();
    return bytes.subarray(20, 20 + length).toString("utf8");
  } catch {
    throw new ChannelError("微信安全消息解密或 AppID 校验失败", 401);
  }
}
export function parseWechatXml(raw: string): Record<string, string> {
  // Official messages have a single flat xml object. Refuse DTD/entity declarations,
  // nested objects, duplicate fields and oversized payloads before using the parser.
  if (
    Buffer.byteLength(raw) > 128_000 ||
    /<!DOCTYPE|<!ENTITY/i.test(raw) ||
    XMLValidator.validate(raw) !== true
  )
    throw new ChannelError("微信 XML 格式无效", 400);
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: false,
    processEntities: true,
  }).parse(raw);
  const xml = parsed.xml;
  if (
    !xml ||
    typeof xml !== "object" ||
    Array.isArray(xml) ||
    Object.keys(parsed).some((key) => key !== "xml" && key !== "?xml")
  )
    throw new ChannelError("微信 XML 根节点无效", 400);
  for (const [key, value] of Object.entries(xml))
    if (!/^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(key) || typeof value !== "string")
      throw new ChannelError("微信 XML 字段无效", 400);
  return xml;
}
export function verifyWechatChallenge(
  url: URL,
  secrets: ChannelSecrets,
  appId: string,
) {
  const { timestamp, nonce } = validWechatQuery(url);
  const echo = url.searchParams.get("echostr") || "";
  // Official-account configuration uses the three-field SHA1 GET handshake,
  // including when subsequent POST deliveries use AES safe mode. Also accept
  // the encrypted four-field handshake without downgrading an invalid signature.
  if (!url.searchParams.has("msg_signature")) {
    const signature = url.searchParams.get("signature") || "";
    const expected = createHash("sha1")
      .update([secrets.verifyToken, timestamp, nonce].sort().join(""))
      .digest("hex");
    if (
      !/^[A-Za-z0-9_-]{1,512}$/.test(echo) ||
      !/^[a-f0-9]{40}$/i.test(signature) ||
      !constantEqual(expected, signature.toLowerCase())
    )
      throw new ChannelError("微信服务器验证失败", 401);
    return echo;
  }
  const signature = url.searchParams.get("msg_signature") || "";
  if (
    echo.length > 8192 ||
    !/^[a-f0-9]{40}$/i.test(signature) ||
    !constantEqual(
      wechatSignature(secrets.verifyToken, timestamp, nonce, echo),
      signature.toLowerCase(),
    )
  )
    throw new ChannelError("微信安全模式验证失败，请选择安全模式", 401);
  return decryptWechat(echo, secrets.aesKey || "", appId);
}
export function verifyWechatMessage(
  url: URL,
  body: Buffer,
  account: ChannelAccount,
  secrets: ChannelSecrets,
): ChannelEvent[] {
  const { timestamp, nonce } = validWechatQuery(url);
  const wrapper = parseWechatXml(body.toString("utf8"));
  const encrypted = wrapper.Encrypt || "";
  const signature = url.searchParams.get("msg_signature") || "";
  if (
    !encrypted ||
    !/^[a-f0-9]{40}$/i.test(signature) ||
    !constantEqual(
      wechatSignature(secrets.verifyToken, timestamp, nonce, encrypted),
      signature.toLowerCase(),
    )
  )
    throw new ChannelError("微信消息签名校验失败", 401);
  const xml = parseWechatXml(
    decryptWechat(encrypted, secrets.aesKey || "", account.config.appId),
  );
  if (account.config.originalId && xml.ToUserName !== account.config.originalId)
    throw new ChannelError("微信原始账号不匹配", 403);
  if (
    !/^[A-Za-z0-9_-]{1,100}$/.test(xml.FromUserName || "") ||
    !/^\d{10}$/.test(xml.CreateTime || "")
  )
    throw new ChannelError("微信消息来源无效", 400);
  const messageType =
    xml.MsgType === "event"
      ? `event.${(xml.Event || "").toLowerCase()}`
      : xml.MsgType;
  if (!/^[a-z.]{1,40}$/.test(messageType || ""))
    throw new ChannelError("微信消息类型无效", 400);
  if (
    xml.MsgType === "event" &&
    !["subscribe", "unsubscribe"].includes((xml.Event || "").toLowerCase())
  )
    return [];
  const descriptions: Record<string, string> = {
    image: "[图片消息]",
    voice: `[语音消息] ${xml.Recognition || ""}`,
    video: "[视频消息]",
    shortvideo: "[短视频消息]",
    location: `[位置] ${xml.Label || ""}`,
    link: `[链接] ${xml.Title || ""} ${xml.Description || ""}`,
    "event.subscribe": "[关注服务号]",
    "event.unsubscribe": "[取消关注服务号]",
  };
  const content =
    xml.MsgType === "text"
      ? xml.Content
      : descriptions[messageType] || `[${messageType}消息]`;
  if (!content || content.length > 20_000)
    throw new ChannelError("微信消息内容为空或过长", 400);
  const eventId = xml.MsgId
    ? `message:${xml.MsgId}`
    : `event:${xml.FromUserName}:${xml.CreateTime}:${messageType}`;
  if (eventId.length > 240 || (xml.MsgId && !/^\d{1,100}$/.test(xml.MsgId)))
    throw new ChannelError("微信消息标识无效", 400);
  return [
    {
      type: "message",
      eventId,
      peerId: xml.FromUserName,
      peerName: `微信用户 ${xml.FromUserName.slice(-6)}`,
      content,
      messageType,
      timestamp: new Date(Number(xml.CreateTime) * 1000).toISOString(),
    },
  ];
}
export function verifyWhatsappSignature(
  body: Buffer,
  signature: string,
  appSecret: string,
) {
  const expected = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
  if (
    !/^sha256=[a-f\d]{64}$/i.test(signature) ||
    !constantEqual(expected, signature.toLowerCase())
  )
    throw new ChannelError("WhatsApp 签名校验失败", 401);
}
const object = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
const array = (input: unknown): unknown[] =>
  Array.isArray(input) ? input : [];
function timestamp(value: unknown) {
  if (typeof value !== "string" || !/^\d{10}$/.test(value))
    throw new ChannelError("WhatsApp 时间无效", 400);
  return new Date(Number(value) * 1000).toISOString();
}
export function parseWhatsappEvents(
  body: Buffer,
  config: Record<string, string>,
): ChannelEvent[] {
  let payload: Record<string, unknown>;
  try {
    payload = object(JSON.parse(body.toString("utf8")));
  } catch {
    throw new ChannelError("WhatsApp JSON 格式无效", 400);
  }
  if (payload.object !== "whatsapp_business_account")
    throw new ChannelError("WhatsApp 账号类型无效", 400);
  const events: ChannelEvent[] = [];
  for (const rawEntry of array(payload.entry)) {
    const entry = object(rawEntry);
    if (config.wabaId && entry.id !== config.wabaId)
      throw new ChannelError("WhatsApp Business 账号不匹配", 403);
    for (const rawChange of array(entry.changes)) {
      const change = object(rawChange);
      if (change.field !== "messages") continue;
      const value = object(change.value);
      if (object(value.metadata).phone_number_id !== config.phoneNumberId)
        throw new ChannelError("WhatsApp 电话号码 ID 不匹配", 403);
      for (const rawMessage of array(value.messages)) {
        const message = object(rawMessage);
        if (
          typeof message.id !== "string" ||
          message.id.length > 200 ||
          !/^[\w.:-]+$/.test(message.id) ||
          typeof message.from !== "string" ||
          !/^\d{5,20}$/.test(message.from)
        )
          throw new ChannelError("WhatsApp 消息标识无效", 400);
        const kind =
          typeof message.type === "string" &&
          /^[a-z_]{1,40}$/.test(message.type)
            ? message.type
            : "unknown";
        const detail = object(message[kind]);
        const profile = array(value.contacts)
          .map(object)
          .find((contact) => contact.wa_id === message.from);
        const name = object(profile?.profile).name;
        const interaction =
          object(detail.button_reply).title || object(detail.list_reply).title;
        const labels: Record<string, string> = {
          image: "图片",
          audio: "语音",
          video: "视频",
          document: "文件",
          sticker: "贴纸",
          location: "位置",
          contacts: "联系人",
          reaction: "表情",
          unsupported: "暂不支持的类型",
        };
        const content =
          kind === "text"
            ? detail.body
            : kind === "button"
              ? detail.text
              : kind === "interactive"
                ? interaction
                : `[${labels[kind] || kind}消息] ${detail.caption || detail.filename || detail.name || ""}`;
        if (typeof content !== "string" || !content || content.length > 20_000)
          throw new ChannelError("WhatsApp 消息内容无效", 400);
        events.push({
          type: "message",
          eventId: `message:${message.id}`,
          peerId: message.from,
          peerName:
            typeof name === "string" ? name.slice(0, 100) : `+${message.from}`,
          content,
          messageType: kind,
          timestamp: timestamp(message.timestamp),
        });
      }
      for (const rawStatus of array(value.statuses)) {
        const status = object(rawStatus);
        if (
          typeof status.id !== "string" ||
          !/^[\w.:-]{1,200}$/.test(status.id) ||
          !["sent", "delivered", "read", "failed"].includes(
            String(status.status),
          )
        )
          throw new ChannelError("WhatsApp 状态回执无效", 400);
        const at = timestamp(status.timestamp);
        const error = object(array(status.errors)[0]);
        const errorCode =
          typeof error.code === "number" ? String(error.code) : undefined;
        events.push({
          type: "status",
          eventId: `status:${status.id}:${status.status}:${status.timestamp}`,
          providerId: status.id,
          status: status.status as "sent" | "delivered" | "read" | "failed",
          timestamp: at,
          errorCode,
        });
      }
    }
  }
  if (events.length > 200) throw new ChannelError("WhatsApp 消息批次过大", 413);
  return events;
}

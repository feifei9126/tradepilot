import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import {
  decryptWechat,
  parseWechatXml,
  verifyWechatChallenge,
  verifyWechatMessage,
  wechatSignature,
  verifyWhatsappSignature,
  parseWhatsappEvents,
} from "../../src/lib/messaging/protocol";
import { nextDeliveryStatus } from "../../src/lib/messaging/inbox";
import { requireReplyWindow } from "../../src/lib/messaging/sending";
import { messageConversationKey } from "../../src/lib/message-conversation";
import type { ChannelAccount } from "../../src/lib/messaging/types";
import type { StoredMessage } from "../../src/lib/store";

const appId = "wx1234567890abcdef";
const key = randomBytes(32);
const aesKey = key.toString("base64").slice(0, 43);
const secrets = {
  verifyToken: "testVerifyToken123",
  appSecret: "a".repeat(32),
  aesKey,
};
const account: ChannelAccount = {
  id: "11111111-1111-4111-8111-111111111111",
  company_id: "22222222-2222-4222-8222-222222222222",
  channel: "wechat",
  name: "Test",
  config: { appId, originalId: "gh_test" },
  secrets_ciphertext: "",
  enabled: true,
};
function encrypt(content: string, recipient = appId) {
  const body = Buffer.from(content),
    length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const plain = Buffer.concat([
    randomBytes(16),
    length,
    body,
    Buffer.from(recipient),
  ]);
  const pad = 32 - (plain.length % 32);
  const cipher = createCipheriv("aes-256-cbc", key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([
    cipher.update(Buffer.concat([plain, Buffer.alloc(pad, pad)])),
    cipher.final(),
  ]).toString("base64");
}
function signed(content: string, recipient = appId) {
  const encrypted = encrypt(content, recipient),
    ts = String(Math.floor(Date.now() / 1000)),
    nonce = "123456";
  const url = new URL("https://example.test/callback");
  url.searchParams.set("timestamp", ts);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set(
    "msg_signature",
    wechatSignature(secrets.verifyToken, ts, nonce, encrypted),
  );
  return {
    url,
    encrypted,
    body: Buffer.from(`<xml><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>`),
  };
}
function wechatXml(content = "Hello &amp; world") {
  return `<xml><ToUserName><![CDATA[gh_test]]></ToUserName><FromUserName><![CDATA[oUser_123]]></FromUserName><CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime><MsgType>text</MsgType><Content>${content}</Content><MsgId>1234567890123456789</MsgId></xml>`;
}
function whatsapp(
  messages: unknown[],
  statuses: unknown[] = [],
  phone = "1234567890",
  waba = "9988776655",
) {
  return Buffer.from(
    JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: waba,
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: phone },
                contacts: [{ wa_id: "15550001111", profile: { name: "Alex" } }],
                messages,
                statuses,
              },
            },
          ],
        },
      ],
    }),
  );
}
const message = {
  id: "wamid.123456",
  from: "15550001111",
  type: "text",
  timestamp: String(Math.floor(Date.now() / 1000)),
  text: { body: "Interested in a quote" },
};

test("WeChat AES wire format round trips UTF-8 and verifies receiver AppID", () => {
  const value = encrypt("测试安全消息");
  assert.equal(decryptWechat(value, aesKey, appId), "测试安全消息");
  assert.throws(
    () => decryptWechat(value, aesKey, "wxwrongapp00000000"),
    /AppID/,
  );
  assert.throws(() => decryptWechat(value.slice(2), aesKey, appId), /解密/);
});
test("WeChat accepts the official configuration GET handshake without permitting plaintext POST messages", () => {
  const ts = String(Math.floor(Date.now() / 1000)),
    nonce = "123456",
    url = new URL("https://example.test/callback");
  url.searchParams.set("timestamp", ts);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("echostr", "random123");
  url.searchParams.set(
    "signature",
    createHash("sha1")
      .update([secrets.verifyToken, ts, nonce].sort().join(""))
      .digest("hex"),
  );
  assert.equal(verifyWechatChallenge(url, secrets, appId), "random123");
  assert.throws(
    () => verifyWechatMessage(url, Buffer.from(wechatXml()), account, secrets),
    /签名/,
  );
});
test("WeChat decrypts the independently published official AES sample", () => {
  // WeChat service guide /guide/dev/push/encryption.html, public documentation sample.
  const encrypted =
    "ELGduP2YcVatjqIS+eZbp80MNLoAUWvzzyJxgGzxZO/5sAvd070Bs6qrLARC9nVHm48Y4hyRbtzve1L32tmxSQ==";
  assert.equal(
    decryptWechat(encrypted, "A".repeat(43), "wxba5fad812f8e6fb9"),
    '{"demo_resp":"good luck"}',
  );
});
test("WeChat validates encrypted URL challenges and rejects an incorrect signature", () => {
  const input = signed("test-challenge");
  input.url.searchParams.set("echostr", input.encrypted);
  assert.equal(
    verifyWechatChallenge(input.url, secrets, appId),
    "test-challenge",
  );
  input.url.searchParams.set("msg_signature", "0".repeat(40));
  assert.throws(
    () => verifyWechatChallenge(input.url, secrets, appId),
    /验证失败/,
  );
});
test("WeChat verifies signature before decoding text and keeps numeric message IDs intact", () => {
  const input = signed(wechatXml());
  const events = verifyWechatMessage(input.url, input.body, account, secrets);
  assert.equal(events[0].eventId, "message:1234567890123456789");
  assert.equal(events[0].type, "message");
  if (events[0].type === "message")
    assert.equal(events[0].content, "Hello & world");
  const other = signed(wechatXml(), "wxwrongapp00000000");
  assert.throws(
    () => verifyWechatMessage(other.url, other.body, account, secrets),
    /AppID/,
  );
});
test("WeChat rejects stale signed envelopes, missing encryption and spoofed original accounts", () => {
  const input = signed(wechatXml());
  input.url.searchParams.set("timestamp", "1600000000");
  assert.throws(
    () => verifyWechatMessage(input.url, input.body, account, secrets),
    /时间/,
  );
  const clear = signed(wechatXml());
  assert.throws(
    () =>
      verifyWechatMessage(
        clear.url,
        Buffer.from(wechatXml()),
        account,
        secrets,
      ),
    /签名/,
  );
  const spoof = signed(wechatXml().replace("gh_test", "gh_attacker"));
  assert.throws(
    () => verifyWechatMessage(spoof.url, spoof.body, account, secrets),
    /原始账号/,
  );
});
test("XML parsing rejects DTDs, external entities, duplicate/nested fields and retains CDATA", () => {
  assert.throws(
    () =>
      parseWechatXml(
        '<!DOCTYPE xml [<!ENTITY x SYSTEM "file:///etc/passwd">]><xml><Content>&x;</Content></xml>',
      ),
    /XML/,
  );
  assert.throws(
    () => parseWechatXml("<xml><Content>a</Content><Content>b</Content></xml>"),
    /字段/,
  );
  assert.throws(
    () => parseWechatXml("<xml><Content><nested>bad</nested></Content></xml>"),
    /字段/,
  );
  assert.equal(
    parseWechatXml("<xml><Content><![CDATA[a < b & c]]></Content></xml>")
      .Content,
    "a < b & c",
  );
});
test("WhatsApp requires an HMAC of the original request body", () => {
  const body = whatsapp([message]),
    secret = "secret";
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  verifyWhatsappSignature(body, signature, secret);
  assert.throws(
    () =>
      verifyWhatsappSignature(
        Buffer.concat([body, Buffer.from(" ")]),
        signature,
        secret,
      ),
    /签名/,
  );
  assert.throws(
    () => verifyWhatsappSignature(body, signature, "wrong"),
    /签名/,
  );
});
test("WhatsApp maps text/media, verifies business and phone IDs and handles status receipts", () => {
  const events = parseWhatsappEvents(
    whatsapp(
      [
        message,
        {
          ...message,
          id: "wamid.media",
          type: "image",
          image: { caption: "Product photo" },
        },
      ],
      [{ id: message.id, status: "read", timestamp: message.timestamp }],
    ),
    { phoneNumberId: "1234567890", wabaId: "9988776655" },
  );
  assert.equal(events.length, 3);
  assert.equal(events[0].type, "message");
  if (events[0].type === "message") assert.equal(events[0].peerName, "Alex");
  assert.equal(events[2].type, "status");
  assert.throws(
    () =>
      parseWhatsappEvents(whatsapp([message]), { phoneNumberId: "0000000000" }),
    /号码/,
  );
  assert.throws(
    () =>
      parseWhatsappEvents(whatsapp([message]), {
        phoneNumberId: "1234567890",
        wabaId: "0000000000",
      }),
    /账号/,
  );
});
test("Delivery statuses do not regress when receipts arrive out of order", () => {
  assert.equal(nextDeliveryStatus("read", "sent"), "read");
  assert.equal(nextDeliveryStatus("delivered", "failed"), "delivered");
  assert.equal(nextDeliveryStatus("sending", "failed"), "failed");
  assert.equal(nextDeliveryStatus("unknown", "sent"), "sent");
});
test("Customer reply windows enforce 48h WeChat, 24h WhatsApp and unsubscribe events", () => {
  const base: StoredMessage = {
    id: "m",
    contactName: "a",
    channel: "wechat",
    direction: "in",
    read: false,
    content: "hello",
    createdAt: new Date(Date.now() - 30 * 3600_000).toISOString(),
  };
  requireReplyWindow(account, base);
  assert.throws(
    () => requireReplyWindow({ ...account, channel: "whatsapp" }, base),
    /24 小时/,
  );
  assert.throws(
    () =>
      requireReplyWindow(account, {
        ...base,
        createdAt: new Date(Date.now() - 49 * 3600_000).toISOString(),
      }),
    /48 小时/,
  );
  assert.throws(
    () =>
      requireReplyWindow(account, {
        ...base,
        messageType: "event.unsubscribe",
      }),
    /窗口/,
  );
});
test("Conversation keys isolate identical display names by channel, account and peer", () => {
  const base: StoredMessage = {
    id: "m",
    contactName: "Alex",
    channel: "wechat",
    direction: "in",
    read: false,
    content: "hello",
    createdAt: "2026-10-13",
  };
  assert.notEqual(
    messageConversationKey(base),
    messageConversationKey({ ...base, channel: "whatsapp" }),
  );
  assert.notEqual(
    messageConversationKey({ ...base, channelAccountId: "a", peerId: "one" }),
    messageConversationKey({ ...base, channelAccountId: "b", peerId: "one" }),
  );
  assert.notEqual(
    messageConversationKey({ ...base, channelAccountId: "a", peerId: "one" }),
    messageConversationKey({ ...base, channelAccountId: "a", peerId: "two" }),
  );
});

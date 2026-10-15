import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  randomUUID,
  createHmac,
  createHash,
  createCipheriv,
  randomBytes,
} from "node:crypto";
import { closeDbPool, getPool, transaction } from "../../src/db";
import { applyMigrations } from "../../scripts/database/migrations.mjs";
import { CrmRepository } from "../../src/lib/crm-repository";
import { runInWorkspace } from "../../src/lib/workspace-context";
import {
  saveChannelAccount,
  listChannelAccounts,
  channelSetup,
  accountSecrets,
  findChannelAccount,
} from "../../src/lib/messaging/accounts";
import { recordChannelEvents } from "../../src/lib/messaging/inbox";
import { sendChannelReply } from "../../src/lib/messaging/sending";
import { ProviderError } from "../../src/lib/messaging/providers";
import { channelWebhook } from "../../src/lib/messaging/webhooks";
import type {
  ChannelAccount,
  IncomingMessage,
  DeliveryEvent,
} from "../../src/lib/messaging/types";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required");
const url = new URL(testUrl);
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
  !url.pathname.endsWith("_test")
)
  throw new Error("Use a separate loopback *_test database");
process.env.DATABASE_URL = testUrl;
process.env.PGSSLMODE = "disable";
const ids: string[] = [];
const prefix = `channels-${randomUUID().slice(0, 8)}`;
type Fixture = {
  id: string;
  ownerId: string;
  memberId: string;
  repo: CrmRepository;
  account: ChannelAccount;
};
const inWorkspace = <T>(
  fixture: Fixture,
  fn: () => T,
  role = "owner",
  userId = fixture.ownerId,
) =>
  runInWorkspace(
    {
      companyId: fixture.id,
      userId,
      role,
      isPlatformAdmin: false,
      store: new CrmRepository(fixture.id, userId, { role }),
    },
    fn,
  );
function event(
  eventId = `message:${randomUUID()}`,
  content = "Hello",
  peerId = "15550001111",
): IncomingMessage {
  return {
    type: "message",
    eventId,
    peerId,
    peerName: "Alex",
    content,
    messageType: "text",
    timestamp: new Date().toISOString(),
  };
}
async function fixture(): Promise<Fixture> {
  const id = randomUUID(),
    ownerId = randomUUID(),
    memberId = randomUUID();
  ids.push(id);
  await getPool().query(
    "INSERT INTO companies(id,name,slug) VALUES($1,$2,$3)",
    [id, prefix, `${prefix}-${id.slice(0, 8)}`],
  );
  for (const [uid, role] of [
    [ownerId, "owner"],
    [memberId, "member"],
  ])
    await getPool().query(
      "INSERT INTO users(id,company_id,email,name,role) VALUES($1,$2,$3,'Test User',$4)",
      [uid, id, `${prefix}-${uid}@example.test`, role],
    );
  const f = {
    id,
    ownerId,
    memberId,
    repo: new CrmRepository(id, ownerId, { role: "owner" }),
    account: {} as ChannelAccount,
  };
  const saved = await inWorkspace(f, () =>
    saveChannelAccount({
      channel: "whatsapp",
      name: "Test WhatsApp",
      phoneNumberId: String(Date.now()) + Math.floor(Math.random() * 1e6),
      wabaId: "9988776655",
      apiVersion: "v24.0",
      appSecret: "a".repeat(32),
      accessToken: "TestAccessTokenOnly123456789",
      verifyToken: "TestVerifyToken123",
    }),
  );
  f.account = await findChannelAccount(saved.id, id);
  return f;
}
before(async () => {
  process.env.TRADEPILOT_CONFIG_KEY = "channel-test-key-" + "z".repeat(40);
  process.env.AUTH_URL = "https://app.example.test";
  await closeDbPool();
  await applyMigrations(getPool());
});
after(async () => {
  try {
    await transaction(async (client) => {
      for (const table of [
        "crm_record_links",
        "crm_records",
        "crm_counters",
        "audit_events",
        "users",
      ])
        await client.query(
          `DELETE FROM ${table} WHERE company_id=ANY($1::uuid[])`,
          [ids],
        );
      await client.query("DELETE FROM companies WHERE id=ANY($1::uuid[])", [
        ids,
      ]);
    });
  } finally {
    await closeDbPool();
  }
});

test("channel secrets are encrypted, scoped to a tenant, and setup is administrator-only", async () => {
  const f = await fixture(),
    other = await fixture();
  assert.ok(!f.account.secrets_ciphertext.includes("TestAccessToken"));
  assert.equal(
    accountSecrets(f.account).accessToken,
    "TestAccessTokenOnly123456789",
  );
  const visible = JSON.stringify(await listChannelAccounts(f.id));
  assert.ok(!visible.includes("TestAccessToken"));
  assert.ok(!visible.includes("TestVerifyToken"));
  await assert.rejects(
    () => findChannelAccount(f.account.id, other.id),
    /不存在/,
  );
  await assert.rejects(
    () =>
      inWorkspace(f, () => channelSetup(f.account.id), "member", f.memberId),
    /管理员/,
  );
  await assert.rejects(
    () =>
      inWorkspace(
        f,
        () => saveChannelAccount({ channel: "wechat" }),
        "member",
        f.memberId,
      ),
    /管理员/,
  );
  const setup = await inWorkspace(f, () => channelSetup(f.account.id));
  assert.equal(setup.verifyToken, "TestVerifyToken123");
});
test("inbound callbacks create a customer/message atomically and concurrent retries do not duplicate", async () => {
  const f = await fixture(),
    incoming = event();
  const results = await Promise.all([
    recordChannelEvents(f.account, [incoming]),
    recordChannelEvents(f.account, [incoming]),
  ]);
  assert.equal(
    results.reduce((n, result) => n + result.accepted, 0),
    1,
  );
  assert.equal((await f.repo.contacts.list()).length, 1);
  assert.equal((await f.repo.messages.list()).length, 1);
  await assert.rejects(
    () => recordChannelEvents(f.account, [{ ...incoming, content: "Changed" }]),
    /冲突/,
  );
  assert.equal((await f.repo.messages.list())[0].content, "Hello");
});
test("a conflicting event rolls back the entire webhook batch and account stop blocks inbound writes", async () => {
  const f = await fixture(),
    incoming = event();
  await recordChannelEvents(f.account, [incoming]);
  await assert.rejects(
    () =>
      recordChannelEvents(f.account, [
        event(),
        { ...incoming, content: "Conflict" },
      ]),
    /冲突/,
  );
  assert.equal((await f.repo.messages.list()).length, 1);
  await inWorkspace(f, () =>
    saveChannelAccount({
      id: f.account.id,
      name: f.account.name,
      ...f.account.config,
      enabled: false,
    }),
  );
  await assert.rejects(() => recordChannelEvents(f.account, [event()]), /停用/);
});
test("callbacks authenticate raw bytes, validate receiver and expose no cookie-auth bypass for configuration", async () => {
  const f = await fixture(),
    secrets = accountSecrets(f.account),
    base = `https://app.example.test/api/channels/whatsapp/${f.account.id}`;
  const challenge = await channelWebhook(
    new Request(
      `${base}?hub.mode=subscribe&hub.verify_token=${secrets.verifyToken}&hub.challenge=123456`,
    ),
    f.account.id,
    "whatsapp",
  );
  assert.equal(challenge.status, 200);
  assert.equal(await challenge.text(), "123456");
  const bad = await channelWebhook(
    new Request(
      `${base}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456`,
    ),
    f.account.id,
    "whatsapp",
  );
  assert.equal(bad.status, 401);
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: f.account.config.wabaId,
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: f.account.config.phoneNumberId },
              messages: [
                {
                  id: "wamid.test",
                  from: "15550001111",
                  type: "text",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: "Incoming" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const signature = `sha256=${createHmac("sha256", secrets.appSecret).update(payload).digest("hex")}`;
  const request = (body = payload, sig = signature) =>
    new Request(base, {
      method: "POST",
      headers: { "x-hub-signature-256": sig },
      body,
    });
  assert.equal(
    (await channelWebhook(request(), f.account.id, "whatsapp")).status,
    200,
  );
  assert.equal(
    (await channelWebhook(request(), f.account.id, "whatsapp")).status,
    200,
  );
  assert.equal(
    (await channelWebhook(request(payload + " "), f.account.id, "whatsapp"))
      .status,
    401,
  );
  assert.equal((await f.repo.messages.list()).length, 1);
});
test("a member cannot send a message attached to another customer owner", async () => {
  const f = await fixture();
  await recordChannelEvents(f.account, [event()]);
  const original = (await f.repo.messages.list())[0];
  await f.repo.contacts.update(original.contactId!, {
    visibility: "private",
    ownerUserId: f.ownerId,
  });
  assert.equal(
    (
      await new CrmRepository(f.id, f.memberId, {
        role: "member",
      }).messages.list()
    ).length,
    0,
  );
  let sends = 0;
  await assert.rejects(
    () =>
      inWorkspace(
        f,
        () =>
          sendChannelReply(
            {
              replyToMessageId: original.id,
              content: "reply",
              idempotencyKey: randomUUID(),
            },
            async () => {
              sends++;
              return "wamid.reply";
            },
          ),
        "member",
        f.memberId,
      ),
    /无权/,
  );
  assert.equal(sends, 0);
});
test("successful replies call the provider once, accept early receipts and prevent duplicate sends", async () => {
  const f = await fixture();
  await recordChannelEvents(f.account, [event()]);
  const original = (await f.repo.messages.list())[0];
  let sends = 0;
  const key = randomUUID(),
    providerId = "wamid.reply";
  const send = async () => {
    sends++;
    await recordChannelEvents(f.account, [
      {
        type: "status",
        eventId: `status:${providerId}:read:123`,
        providerId,
        status: "read",
        timestamp: new Date().toISOString(),
      },
    ]);
    return providerId;
  };
  const first = await inWorkspace(f, () =>
    sendChannelReply(
      { replyToMessageId: original.id, content: "Thanks", idempotencyKey: key },
      send,
    ),
  );
  assert.equal(first.message.deliveryStatus, "read");
  assert.equal(sends, 1);
  const again = await inWorkspace(f, () =>
    sendChannelReply(
      { replyToMessageId: original.id, content: "Thanks", idempotencyKey: key },
      send,
    ),
  );
  assert.equal(again.reused, true);
  assert.equal(sends, 1);
  await assert.rejects(
    () =>
      inWorkspace(f, () =>
        sendChannelReply(
          {
            replyToMessageId: original.id,
            content: "Changed",
            idempotencyKey: key,
          },
          send,
        ),
      ),
    /另一条回复/,
  );
  const receipt: DeliveryEvent = {
    type: "status",
    eventId: `status:${providerId}:sent:123`,
    providerId,
    status: "sent",
    timestamp: new Date().toISOString(),
  };
  await recordChannelEvents(f.account, [receipt]);
  assert.equal(
    (await f.repo.messages.get(first.message.id))?.deliveryStatus,
    "read",
  );
});
test("uncertain network outcomes are saved and a replay never automatically resends", async () => {
  const f = await fixture();
  await recordChannelEvents(f.account, [event()]);
  const original = (await f.repo.messages.list())[0];
  let sends = 0;
  const input = {
    replyToMessageId: original.id,
    content: "Thanks",
    idempotencyKey: randomUUID(),
  };
  const send = async () => {
    sends++;
    throw new ProviderError("network outcome uncertain", "network", true);
  };
  const response = await inWorkspace(f, () => sendChannelReply(input, send));
  assert.equal(response.message.deliveryStatus, "unknown");
  await inWorkspace(f, () => sendChannelReply(input, send));
  assert.equal(sends, 1);
});
test("expired windows do not reserve or send; current incoming resumes the reply window", async () => {
  const f = await fixture();
  const expired = {
    ...event(),
    timestamp: new Date(Date.now() - 25 * 3600_000).toISOString(),
  };
  await recordChannelEvents(f.account, [expired]);
  const original = (await f.repo.messages.list())[0];
  let sends = 0;
  const send = async () => {
    sends++;
    return "wamid.resume";
  };
  await assert.rejects(
    () =>
      inWorkspace(f, () =>
        sendChannelReply(
          {
            replyToMessageId: original.id,
            content: "Thanks",
            idempotencyKey: randomUUID(),
          },
          send,
        ),
      ),
    /24 小时/,
  );
  assert.equal(sends, 0);
  await recordChannelEvents(f.account, [event()]);
  await inWorkspace(f, () =>
    sendChannelReply(
      {
        replyToMessageId: original.id,
        content: "Thanks",
        idempotencyKey: randomUUID(),
      },
      send,
    ),
  );
  assert.equal(sends, 1);
});
test("credential rotation invalidates old webhook snapshots and keeps secret material out of audit records", async () => {
  const f = await fixture();
  await inWorkspace(f, () =>
    saveChannelAccount({
      id: f.account.id,
      name: "Updated",
      ...f.account.config,
      verifyToken: "RotatedToken456",
    }),
  );
  await assert.rejects(
    () => recordChannelEvents(f.account, [event()]),
    /凭据已更新/,
  );
  const current = await findChannelAccount(f.account.id, f.id);
  assert.equal(accountSecrets(current).verifyToken, "RotatedToken456");
  assert.equal(
    accountSecrets(current).accessToken,
    "TestAccessTokenOnly123456789",
  );
  const audit = JSON.stringify(
    (
      await getPool().query(
        "SELECT details FROM audit_events WHERE company_id=$1",
        [f.id],
      )
    ).rows,
  );
  assert.ok(!audit.includes("RotatedToken"));
  assert.ok(!audit.includes("TestAccessToken"));
});

test("WeChat official GET verification and encrypted POST persist a service-account conversation", async () => {
  const f = await fixture(),
    saved = await inWorkspace(f, () =>
      saveChannelAccount({
        channel: "wechat",
        name: "Test Service Account",
        appId: `wx${randomBytes(8).toString("hex")}`,
        originalId: "gh_test",
        appSecret: "b".repeat(32),
      }),
    );
  const account = await findChannelAccount(saved.id, f.id),
    secrets = accountSecrets(account);
  const base = `https://app.example.test/api/channels/wechat/${account.id}`,
    ts = String(Math.floor(Date.now() / 1000)),
    nonce = "12345";
  const signature = createHash("sha1")
    .update([secrets.verifyToken, ts, nonce].sort().join(""))
    .digest("hex");
  const verification = await channelWebhook(
    new Request(
      `${base}?timestamp=${ts}&nonce=${nonce}&signature=${signature}&echostr=random123`,
    ),
    account.id,
    "wechat",
  );
  assert.equal(verification.status, 200);
  assert.equal(await verification.text(), "random123");
  const xml = `<xml><ToUserName>gh_test</ToUserName><FromUserName>oUser_123</FromUserName><CreateTime>${ts}</CreateTime><MsgType>text</MsgType><Content>WeChat quotation request</Content><MsgId>123456789123456789</MsgId></xml>`;
  const key = Buffer.from(secrets.aesKey + "=", "base64"),
    body = Buffer.from(xml),
    len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const bytes = Buffer.concat([
      randomBytes(16),
      len,
      body,
      Buffer.from(account.config.appId),
    ]),
    pad = 32 - (bytes.length % 32);
  const cipher = createCipheriv("aes-256-cbc", key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([bytes, Buffer.alloc(pad, pad)])),
    cipher.final(),
  ]).toString("base64");
  const signed = createHash("sha1")
    .update([secrets.verifyToken, ts, nonce, encrypted].sort().join(""))
    .digest("hex");
  const callback = `${base}?timestamp=${ts}&nonce=${nonce}&msg_signature=${signed}`;
  const make = () =>
    new Request(callback, {
      method: "POST",
      body: `<xml><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>`,
    });
  assert.equal(
    (await channelWebhook(make(), account.id, "wechat")).status,
    200,
  );
  assert.equal(
    (await channelWebhook(make(), account.id, "wechat")).status,
    200,
  );
  const messages = await f.repo.messages.list();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].channel, "wechat");
  assert.equal(messages[0].content, "WeChat quotation request");
  const clear = await channelWebhook(
    new Request(callback, { method: "POST", body: xml }),
    account.id,
    "wechat",
  );
  assert.equal(clear.status, 401);
});

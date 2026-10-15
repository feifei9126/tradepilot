import { randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { query } from "@/db";
import { getStore, currentWorkspace } from "@/lib/workspace-context";
import { decryptTenantSecret, encryptTenantSecret } from "@/lib/tenant-secret";
import {
  ChannelError,
  type ChannelAccount,
  type ChannelSecrets,
  type PublicChannelAccount,
  type MessagingChannel,
} from "./types";

export function requireChannelAdmin() {
  if (
    !["owner", "admin", "platform-admin"].includes(
      currentWorkspace()?.role || "",
    )
  )
    throw new ChannelError("仅工作区所有者或管理员可以配置消息渠道", 403);
}
export function accountSecrets(account: ChannelAccount): ChannelSecrets {
  return JSON.parse(
    decryptTenantSecret(
      account.secrets_ciphertext,
      `messaging-account:${account.id}`,
      account.company_id,
    ),
  );
}
export async function findChannelAccount(
  id: string,
  companyId?: string,
  channel?: MessagingChannel,
): Promise<ChannelAccount> {
  if (!/^[a-f\d-]{36}$/i.test(id))
    throw new ChannelError("消息渠道不存在", 404);
  const result = await query<ChannelAccount>(
    `SELECT a.* FROM messaging_accounts a JOIN companies c ON c.id=a.company_id
    WHERE a.id=$1 AND c.is_active=true AND ($2::uuid IS NULL OR a.company_id=$2) AND ($3::text IS NULL OR a.channel=$3)`,
    [id, companyId || null, channel || null],
  );
  if (!result.rows[0])
    throw new ChannelError("消息渠道不存在或工作区已停用", 404);
  return result.rows[0];
}
export function callbackAddress(channel: MessagingChannel, id: string) {
  let origin = "";
  try {
    origin = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || "")
      .origin;
  } catch {}
  let ready = false;
  if (origin) {
    const url = new URL(origin);
    ready =
      url.protocol === "https:" &&
      !isIP(url.hostname.replace(/^\[|\]$/g, "")) &&
      !/(^localhost$|\.localhost$|\.local$|\.internal$)/i.test(url.hostname) &&
      url.hostname.includes(".");
  }
  return {
    callbackUrl: `${origin}/api/channels/${channel}/${id}`,
    publicCallbackReady: ready,
  };
}
function publicAccount(
  row: ChannelAccount & Record<string, unknown>,
): PublicChannelAccount {
  const secrets = accountSecrets(row);
  const iso = (key: string) =>
    row[key] ? new Date(String(row[key])).toISOString() : null;
  return {
    id: row.id,
    channel: row.channel,
    name: row.name,
    config: row.config,
    enabled: row.enabled,
    ...callbackAddress(row.channel, row.id),
    lastVerifiedAt: iso("last_verified_at"),
    lastReceivedAt: iso("last_received_at"),
    lastTestedAt: iso("last_tested_at"),
    lastError: typeof row.last_error === "string" ? row.last_error : null,
    hasAppSecret: Boolean(secrets.appSecret),
    hasAccessToken: Boolean(secrets.accessToken),
  };
}
export async function listChannelAccounts(companyId: string) {
  const rows = await query<ChannelAccount & Record<string, unknown>>(
    "SELECT * FROM messaging_accounts WHERE company_id=$1 ORDER BY created_at",
    [companyId],
  );
  return rows.rows.map(publicAccount);
}
const string = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
export async function saveChannelAccount(input: Record<string, unknown>) {
  requireChannelAdmin();
  const repository = getStore();
  const previous = input.id
    ? await findChannelAccount(string(input.id), repository.companyId)
    : undefined;
  const channel = previous?.channel || string(input.channel);
  if (channel !== "wechat" && channel !== "whatsapp")
    throw new ChannelError("请选择微信服务号或 WhatsApp", 400);
  const id = previous?.id || randomUUID();
  const name = string(input.name);
  if (!name || name.length > 100 || /[\x00-\x1f]/.test(name))
    throw new ChannelError("渠道名称必须为 1–100 个字符", 400);
  const oldSecrets = previous ? accountSecrets(previous) : undefined;
  const verifyToken =
    string(input.verifyToken) ||
    oldSecrets?.verifyToken ||
    randomBytes(16).toString("hex");
  const appSecret = string(input.appSecret) || oldSecrets?.appSecret || "";
  if (
    !/^[A-Za-z0-9]{3,32}$/.test(verifyToken) ||
    !/^[a-f\d]{32}$/i.test(appSecret)
  )
    throw new ChannelError(
      "验证 Token 需 3–32 位字母数字，AppSecret 需 32 位十六进制字符",
      400,
    );
  const config: Record<string, string> = {};
  const secrets: ChannelSecrets = { verifyToken, appSecret };
  if (channel === "wechat") {
    config.appId = string(input.appId) || previous?.config.appId || "";
    config.originalId = string(input.originalId) || "";
    secrets.aesKey =
      string(input.aesKey) ||
      oldSecrets?.aesKey ||
      randomBytes(32).toString("base64").slice(0, 43);
    if (
      !/^wx[A-Za-z0-9]{16}$/.test(config.appId) ||
      (config.originalId &&
        !/^gh_[A-Za-z0-9]{1,30}$/.test(config.originalId)) ||
      !/^[A-Za-z0-9+/]{43}$/.test(secrets.aesKey)
    )
      throw new ChannelError(
        "微信 AppID、原始 ID 或 EncodingAESKey 格式无效",
        400,
      );
    if (previous && previous.config.appId !== config.appId)
      throw new ChannelError("已有渠道的 AppID 不可更换，请新建渠道", 409);
  } else {
    config.phoneNumberId =
      string(input.phoneNumberId) || previous?.config.phoneNumberId || "";
    config.wabaId = string(input.wabaId);
    config.apiVersion =
      string(input.apiVersion) || previous?.config.apiVersion || "v24.0";
    secrets.accessToken =
      string(input.accessToken) || oldSecrets?.accessToken || "";
    if (
      !/^\d{5,30}$/.test(config.phoneNumberId) ||
      (config.wabaId && !/^\d{5,30}$/.test(config.wabaId)) ||
      !/^v\d{1,3}\.0$/.test(config.apiVersion) ||
      !/^[A-Za-z0-9_.|-]{20,4096}$/.test(secrets.accessToken)
    )
      throw new ChannelError(
        "WhatsApp Phone Number ID、Business ID、API 版本或 Access Token 格式无效",
        400,
      );
    if (previous && previous.config.phoneNumberId !== config.phoneNumberId)
      throw new ChannelError("已有渠道的号码 ID 不可更换，请新建渠道", 409);
  }
  const encrypted = encryptTenantSecret(
    JSON.stringify(secrets),
    `messaging-account:${id}`,
    repository.companyId,
  );
  const credentialsChanged =
    !oldSecrets || JSON.stringify(oldSecrets) !== JSON.stringify(secrets);
  await repository.write(async (client) => {
    if (previous) {
      const live = await client.query(
        "SELECT secrets_ciphertext,config FROM messaging_accounts WHERE company_id=$1 AND id=$2 FOR UPDATE",
        [repository.companyId, id],
      );
      if (
        !live.rows[0] ||
        live.rows[0].secrets_ciphertext !== previous.secrets_ciphertext ||
        JSON.stringify(live.rows[0].config) !== JSON.stringify(previous.config)
      )
        throw new ChannelError("渠道配置已被更新，请刷新后再保存", 409);
    } else {
      const count = await client.query(
        "SELECT count(*)::int AS n FROM messaging_accounts WHERE company_id=$1",
        [repository.companyId],
      );
      if (count.rows[0].n >= 20)
        throw new ChannelError("每个工作区最多配置 20 个消息渠道", 409);
    }
    await client.query(
      `INSERT INTO messaging_accounts(id,company_id,channel,name,config,secrets_ciphertext,enabled)
      VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,config=EXCLUDED.config,secrets_ciphertext=EXCLUDED.secrets_ciphertext,enabled=EXCLUDED.enabled,
        access_token_ciphertext=NULL,access_token_expires_at=NULL,last_error=NULL,
        last_verified_at=CASE WHEN $8 THEN NULL ELSE messaging_accounts.last_verified_at END,updated_at=now()
      WHERE messaging_accounts.company_id=EXCLUDED.company_id`,
      [
        id,
        repository.companyId,
        channel,
        name,
        JSON.stringify(config),
        encrypted,
        input.enabled !== false,
        credentialsChanged,
      ],
    );
    await repository.auditIn(
      client,
      previous ? "messaging.account.updated" : "messaging.account.created",
      id,
      { channel, credentialsChanged, enabled: input.enabled !== false },
    );
  });
  return (await listChannelAccounts(repository.companyId)).find(
    (account) => account.id === id,
  )!;
}
export async function channelSetup(id: string) {
  requireChannelAdmin();
  const account = await findChannelAccount(id, getStore().companyId);
  const secrets = accountSecrets(account);
  await getStore().write((client) =>
    getStore().auditIn(client, "messaging.setup.viewed", id, {}),
  );
  return {
    verifyToken: secrets.verifyToken,
    ...(account.channel === "wechat" ? { aesKey: secrets.aesKey } : {}),
  };
}

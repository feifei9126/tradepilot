import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { query, transaction } from "@/db";
import { decryptTenantSecret, encryptTenantSecret } from "@/lib/tenant-secret";
import { takeDistributedRateLimit } from "@/lib/distributed-rate-limit";

export class TenantWebhookError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

async function requireWorkspaceAdmin(client: PoolClient, companyId: string, userId: string) {
  const result = await client.query(`SELECT u.role,u.is_active,u.settings,c.is_active AS company_active
    FROM users u JOIN companies c ON c.id=u.company_id WHERE u.id=$1 AND u.company_id=$2 FOR UPDATE OF u,c`, [userId, companyId]);
  const user = result.rows[0];
  if (!user || user.is_active !== true || user.company_active !== true || user.settings?.mustChangePassword === true) throw new TenantWebhookError("工作区或账号不可用，请重新登录", 403);
  if (!(["owner", "admin"] as string[]).includes(user.role)) throw new TenantWebhookError("只有工作区所有者或管理员可以管理 Webhook", 403);
}

export async function getTenantWebhookCredential(companyId: string) {
  const result = await query("SELECT rotated_at AS \"rotatedAt\", previous_valid_until AS \"previousValidUntil\" FROM tenant_webhook_credentials WHERE company_id=$1", [companyId]);
  return { configured: Boolean(result.rowCount), rotatedAt: result.rows[0]?.rotatedAt ?? null, previousValidUntil: result.rows[0]?.previousValidUntil ?? null };
}

export async function rotateTenantWebhookCredential(companyId: string, actorId: string) {
  const secret = randomBytes(32).toString("base64url");
  const encrypted = encryptTenantSecret(secret, "webhook-hmac", companyId);
  return transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`tenant-webhook:${companyId}`]);
    await requireWorkspaceAdmin(client, companyId, actorId);
    const old = await client.query("SELECT secret_ciphertext FROM tenant_webhook_credentials WHERE company_id=$1 FOR UPDATE", [companyId]);
    await client.query(`INSERT INTO tenant_webhook_credentials(company_id,secret_ciphertext,previous_secret_ciphertext,previous_valid_until,rotated_by,rotated_at)
      VALUES($1,$2,NULL,NULL,$3,now())
      ON CONFLICT(company_id) DO UPDATE SET secret_ciphertext=EXCLUDED.secret_ciphertext,
       previous_secret_ciphertext=tenant_webhook_credentials.secret_ciphertext,
       previous_valid_until=CASE WHEN tenant_webhook_credentials.secret_ciphertext IS NULL THEN NULL ELSE now()+interval '15 minutes' END,
       rotated_by=EXCLUDED.rotated_by,rotated_at=now()`, [companyId, encrypted, actorId]);
    await client.query("INSERT INTO audit_events(company_id,actor_id,action,target_id,details) VALUES($1,$2,'tenant.webhook.rotate',$1,'{}'::jsonb)", [companyId, actorId]);
    return { secret, rotatedAt: new Date().toISOString(), previousSecretGraceMinutes: old.rowCount ? 15 : 0 };
  });
}

function validSignature(secret: string, timestamp: string, eventId: string, body: Buffer, signature: string) {
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(eventId).update(".").update(body).digest();
  const candidate = Buffer.from(signature.replace(/^v1=/, ""), "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function recordIncomingTenantWebhook(input: { slug: string; eventId: string; timestamp: string; signature: string; body: Buffer }) {
  if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(input.slug)) throw new TenantWebhookError("Webhook 工作区标识格式不正确", 404);
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(input.eventId)) throw new TenantWebhookError("Webhook 事件 ID 无效", 400);
  if (!/^\d{10}$/.test(input.timestamp)) throw new TenantWebhookError("Webhook 时间戳无效", 401);
  if (!/^v1=[a-f0-9]{64}$/i.test(input.signature)) throw new TenantWebhookError("Webhook 签名无效", 401);
  if (input.body.length < 2 || input.body.length > 64_000) throw new TenantWebhookError("Webhook 请求体为空或超过 64 KB", 413);
  const seconds = Number(input.timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) throw new TenantWebhookError("Webhook 时间戳已过期或超前", 401);
  let payload: unknown;
  try { payload = JSON.parse(input.body.toString("utf8")); } catch { throw new TenantWebhookError("Webhook JSON 格式不正确", 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TenantWebhookError("Webhook 内容必须是 JSON 对象", 400);
  const record = payload as Record<string, unknown>;
  const eventType = typeof record.type === "string" ? record.type.trim() : "";
  if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(eventType)) throw new TenantWebhookError("Webhook 内容必须包含有效的 type", 400);

  const credentials = await query(`SELECT c.id AS company_id,w.secret_ciphertext,w.previous_secret_ciphertext,w.previous_valid_until
    FROM companies c JOIN tenant_webhook_credentials w ON w.company_id=c.id
    WHERE c.slug=$1 AND c.is_active=true`, [input.slug]);
  const credential = credentials.rows[0];
  if (!credential) throw new TenantWebhookError("Webhook 凭据不存在或工作区已停用", 404);
  const throttle = await takeDistributedRateLimit("tenant-webhook:120/60", credential.company_id, 120, 60);
  if (!throttle.allowed) throw new TenantWebhookError("Webhook 请求过于频繁", 429);
  const currentSecret = decryptTenantSecret(credential.secret_ciphertext, "webhook-hmac", credential.company_id);
  let signed = validSignature(currentSecret, input.timestamp, input.eventId, input.body, input.signature);
  if (!signed && credential.previous_secret_ciphertext && credential.previous_valid_until && new Date(credential.previous_valid_until).getTime() >= Date.now()) {
    const previousSecret = decryptTenantSecret(credential.previous_secret_ciphertext, "webhook-hmac", credential.company_id);
    signed = validSignature(previousSecret, input.timestamp, input.eventId, input.body, input.signature);
  }
  if (!signed) throw new TenantWebhookError("Webhook 签名校验失败", 401);

  const digest = createHash("sha256").update(input.body).digest("hex");
  const result = await query(`INSERT INTO webhook_events(id,company_id,event_id,event_type,payload_sha256)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(company_id,event_id) DO NOTHING RETURNING id`, [randomUUID(), credential.company_id, input.eventId, eventType, digest]);
  if (!result.rowCount) return { accepted: true, duplicate: true, eventType };
  await query("INSERT INTO audit_events(company_id,actor_id,action,target_id,details) VALUES($1,$2,'tenant.webhook.accepted',$3,$4::jsonb)", [credential.company_id, `webhook:${input.slug}`, input.eventId, JSON.stringify({ eventType, payloadSha256: digest })]);
  if (Math.random() < 1 / 128) await query("DELETE FROM webhook_events WHERE company_id=$1 AND received_at < now()-interval '180 days'", [credential.company_id]).catch(() => {});
  // The event ledger intentionally does not execute arbitrary actions or retain
  // payload contents. A business-specific adapter can consume verified events.
  return { accepted: true, duplicate: false, eventType };
}

export function signTenantWebhook(secret: string, timestamp: string, eventId: string, body: Buffer) {
  return `v1=${createHmac("sha256", secret).update(timestamp).update(".").update(eventId).update(".").update(body).digest("hex")}`;
}

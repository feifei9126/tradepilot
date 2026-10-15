import { randomUUID } from "node:crypto";
import { query, transaction } from "@/db";
import { BillingError } from "@/lib/billing";

export type EmailSendStatus = "pending" | "sent" | "failed";

function dailyLimit() {
  const value = Number(process.env.EMAIL_DAILY_SEND_LIMIT || "500");
  return Number.isInteger(value) && value >= 1 && value <= 100_000 ? value : 500;
}

function safeIdempotencyKey(value: string) {
  const key = value.trim();
  return key.length >= 8 && key.length <= 200 ? key : null;
}

export async function reserveEmailSend(input: {
  companyId: string;
  accountId: string;
  recipientCount: number;
  marketing: boolean;
  idempotencyKey: string;
}) {
  if (input.recipientCount < 1 || input.recipientCount > 100) {
    throw new BillingError("一次最多发送给 100 个收件人", 400, "EMAIL_RECIPIENT_LIMIT");
  }
  const idempotencyKey = safeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) throw new BillingError("请提供 8 到 200 个字符的幂等请求编号", 400, "EMAIL_IDEMPOTENCY_REQUIRED");
  return transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`email-send:${input.companyId}`]);
    const existing = await client.query(`SELECT id,status,provider_message_id,failure_code,recipient_count,marketing,created_at,completed_at
      FROM email_send_events WHERE company_id=$1 AND idempotency_key=$2 FOR UPDATE`, [input.companyId, idempotencyKey]);
    if (existing.rowCount) return { duplicate: true, event: existing.rows[0] };

    const usage = await client.query(`SELECT coalesce(sum(recipient_count),0)::int AS count
      FROM email_send_events
      WHERE company_id=$1 AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        AND status IN ('pending','sent')`, [input.companyId]);
    const used = Number(usage.rows[0]?.count || 0);
    const limit = dailyLimit();
    if (used + input.recipientCount > limit) {
      throw new BillingError(`本工作区今日邮件额度不足（已使用 ${used}/${limit}）`, 429, "EMAIL_DAILY_LIMIT");
    }
    const id = randomUUID();
    const inserted = await client.query(`INSERT INTO email_send_events(id,company_id,account_id,idempotency_key,recipient_count,marketing,status)
      VALUES($1,$2,$3,$4,$5,$6,'pending') RETURNING id,status,recipient_count,marketing,created_at`, [id, input.companyId, input.accountId, idempotencyKey, input.recipientCount, input.marketing]);
    return { duplicate: false, event: inserted.rows[0] };
  });
}

export async function finishEmailSend(id: string, result: { status: EmailSendStatus; providerMessageId?: string; failureCode?: string }) {
  await query(`UPDATE email_send_events SET status=$2,provider_message_id=$3,failure_code=$4,completed_at=now() WHERE id=$1 AND status='pending'`, [id, result.status, result.providerMessageId?.slice(0, 500) || null, result.failureCode?.slice(0, 100) || null]);
}

export function publicEmailSendEvent(event: Record<string, unknown>) {
  return {
    id: String(event.id), status: String(event.status), recipientCount: Number(event.recipient_count || 0),
    marketing: event.marketing === true, providerMessageId: event.provider_message_id || null,
    failureCode: event.failure_code || null, createdAt: event.created_at || null, completedAt: event.completed_at || null,
  };
}

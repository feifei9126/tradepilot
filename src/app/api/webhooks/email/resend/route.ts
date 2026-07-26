import { NextRequest, NextResponse } from "next/server";

import { getPostgresEmailRepository } from "@/lib/email/runtime";
import { openEmailAccountCredentials, requireEmailCredentialsKey } from "@/lib/email/service";
import { ingestInboundEmail, normalizeCloudflareInboundEmail, verifyResendWebhookSignature } from "@/lib/email/inbound";
import type { EmailAccount } from "@/lib/email/types";

export const runtime = "nodejs";

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

function safeEventPayload(value: Record<string, unknown>) {
  const data = recordValue(value.data);
  return {
    type: firstString(value.type, value.event, "email.received").slice(0, 100),
    id: firstString(value.id, value.event_id).slice(0, 512),
    data: {
      email_id: firstString(data.email_id, data.id).slice(0, 512),
      from: firstString(data.from).slice(0, 320),
      to: Array.isArray(data.to) ? data.to.filter((item): item is string => typeof item === "string").slice(0, 50) : firstString(data.to).slice(0, 320),
      subject: firstString(data.subject).slice(0, 500),
    },
  };
}

function identify(payload: Record<string, unknown>) {
  const data = recordValue(payload.data);
  const metadata = recordValue(data.metadata);
  return {
    companyId: firstString(payload.companyId, payload.company_id, data.companyId, data.company_id, metadata.companyId),
    accountId: firstString(payload.accountId, payload.account_id, data.accountId, data.account_id, metadata.accountId),
  };
}

async function selectAccount(payload: Record<string, unknown>) {
  const ids = identify(payload);
  if (!ids.companyId || !ids.accountId) return null;
  const repository = getPostgresEmailRepository();
  const account = (await repository.listAccounts(ids.companyId)).find((candidate) => candidate.id === ids.accountId && candidate.provider === "resend" && candidate.status === "active");
  return account ? { repository, account } : null;
}

function eventData(payload: Record<string, unknown>) {
  return recordValue(payload.data);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 5_000_000) return NextResponse.json({ error: "Invalid webhook payload", code: "VALIDATION_ERROR" }, { status: 400 });
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object expected");
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const selected = await selectAccount(payload);
    if (!selected) return NextResponse.json({ error: "Webhook account is invalid", code: "UNAUTHORIZED" }, { status: 401 });
    const credentials = await openEmailAccountCredentials(selected.account, requireEmailCredentialsKey());
    const secret = credentials.webhookSecret || process.env.RESEND_WEBHOOK_SECRET;
    if (!secret || !verifyResendWebhookSignature({ rawBody, headers: request.headers, secret })) {
      return NextResponse.json({ error: "Webhook signature is invalid", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const data = eventData(payload);
    const eventId = firstString(request.headers.get("svix-id"), payload.id, payload.event_id, data.id, data.email_id);
    if (!eventId) return NextResponse.json({ error: "Webhook event id is required", code: "VALIDATION_ERROR" }, { status: 400 });
    const raw = typeof data.raw === "string" ? data.raw : typeof data.rawMime === "string" ? data.rawMime : undefined;
    const normalized = raw
      ? await ingestInboundEmail({
        repository: selected.repository,
        companyId: selected.account.companyId,
        accountId: selected.account.id,
        threadId: firstString(data.threadId, data.thread_id) || undefined,
        provider: "resend",
        providerEventId: eventId,
        eventType: firstString(payload.type, payload.event, "email.received"),
        eventPayload: safeEventPayload(payload),
        providerMessageId: firstString(data.messageId, data.message_id, data.email_id) || null,
        rawMime: raw,
      })
      : await ingestInboundEmail({
        repository: selected.repository,
        companyId: selected.account.companyId,
        accountId: selected.account.id,
        threadId: firstString(data.threadId, data.thread_id) || undefined,
        provider: "resend",
        providerEventId: eventId,
        eventType: firstString(payload.type, payload.event, "email.received"),
        eventPayload: safeEventPayload(payload),
        providerMessageId: firstString(data.messageId, data.message_id, data.email_id) || null,
        rawMime: await normalizedMime(data, selected.account),
      });
    return NextResponse.json({ ok: true, duplicate: !normalized.created });
  } catch {
    return NextResponse.json({ error: "Webhook could not be processed", code: "VALIDATION_ERROR" }, { status: 400 });
  }
}

async function normalizedMime(data: Record<string, unknown>, account: EmailAccount) {
  const result = await normalizeCloudflareInboundEmail({
    companyId: account.companyId,
    accountId: account.id,
    threadId: firstString(data.threadId, data.thread_id) || undefined,
    provider: "resend",
    providerMessageId: firstString(data.messageId, data.message_id, data.email_id) || null,
    from: firstString(data.from),
    to: Array.isArray(data.to) ? data.to.filter((item): item is string => typeof item === "string") : firstString(data.to),
    subject: firstString(data.subject),
    text: typeof data.text === "string" ? data.text : "",
    html: typeof data.html === "string" ? data.html : undefined,
    headers: data.headers && typeof data.headers === "object" && !Array.isArray(data.headers) ? data.headers as Record<string, string> : undefined,
  });
  const from = result.from[0]?.email || "unknown@example.invalid";
  const to = result.to[0]?.email || account.email;
  if (result.htmlBody) {
    const boundary = "tradepilot-inbound";
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${result.subject}`,
      `Date: ${result.receivedAt || new Date().toISOString()}`,
      `Content-Type: multipart/alternative; boundary=${boundary}`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      result.textBody || "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      result.htmlBody,
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }
  return `From: ${from}\r\nTo: ${to}\r\nSubject: ${result.subject}\r\nDate: ${result.receivedAt || new Date().toISOString()}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${result.textBody || ""}`;
}

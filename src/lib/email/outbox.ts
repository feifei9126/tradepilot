import { randomUUID } from "node:crypto";

import { openEmailAccountCredentials, requireEmailCredentialsKey } from "./service";
import type { EmailAccount, EmailOutboxItem, EmailRepository } from "./types";
import {
  ResendEmailProvider,
  ProviderSendError,
  type EmailProviderAdapter,
} from "./providers/resend";
import type { SendEmailInput } from "./providers/contracts";

export const OUTBOX_MAX_ATTEMPTS = 8;
export const OUTBOX_LEASE_DURATION_MS = 5 * 60 * 1000;
export const OUTBOX_RETRY_DELAYS_MS = [
  30 * 1000,
  2 * 60 * 1000,
  10 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;
export const RETRY_DELAYS_MS = OUTBOX_RETRY_DELAYS_MS;
export const OUTBOX_RETRY_DELAYS = OUTBOX_RETRY_DELAYS_MS;

type Clock = () => Date;

export interface OutboxProcessorOptions {
  repository: EmailRepository;
  limit?: number;
  now?: Date;
  clock?: Clock;
  leaseDurationMs?: number;
  credentialsKey?: string | Uint8Array;
  adapterForAccount?: (account: EmailAccount, credentials: Record<string, string>) => EmailProviderAdapter | Promise<EmailProviderAdapter>;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function addressValue(value: unknown, field: string): string | string[] {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string" && entry.trim())) {
    return value.map((entry) => (entry as string).trim());
  }
  throw new ProviderSendError("PROVIDER_INVALID_REQUEST", `Email ${field} is invalid`, false);
}

function sendPayload(payload: Record<string, unknown>, account: EmailAccount, idempotencyKey: string): SendEmailInput {
  const from = typeof payload.from === "string" && payload.from.trim() ? payload.from.trim() : account.email;
  const subject = typeof payload.subject === "string" ? payload.subject.trim().slice(0, 500) : "";
  const html = typeof payload.html === "string" ? payload.html : "";
  const text = typeof payload.text === "string" ? payload.text : "";
  if (!from || !subject || (!html && !text)) {
    throw new ProviderSendError("PROVIDER_INVALID_REQUEST", "Email payload is invalid", false);
  }
  const result: SendEmailInput = {
    from,
    to: addressValue(payload.to, "recipient"),
    subject,
    html,
    text,
    idempotencyKey,
  };
  if (payload.cc !== undefined) result.cc = addressValue(payload.cc, "cc");
  if (payload.bcc !== undefined) result.bcc = addressValue(payload.bcc, "bcc");
  if (payload.replyTo !== undefined) result.replyTo = addressValue(payload.replyTo, "reply-to");
  return result;
}

function failure(error: unknown) {
  if (error instanceof ProviderSendError) return error;
  if (error && typeof error === "object" && "retryable" in error && "code" in error) {
    const candidate = error as { retryable?: unknown; code?: unknown; message?: unknown; status?: unknown };
    return new ProviderSendError(
      typeof candidate.code === "string" ? candidate.code as ProviderSendError["code"] : "PROVIDER_NETWORK_ERROR",
      typeof candidate.message === "string" ? candidate.message : "Email provider request failed",
      candidate.retryable === true,
      typeof candidate.status === "number" ? candidate.status : undefined,
    );
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code || "");
    if (code.startsWith("CREDENTIALS_") || code === "PROVIDER_NOT_CONFIGURED" || code === "DATABASE_NOT_CONFIGURED") {
      return new ProviderSendError("PROVIDER_AUTH_FAILED", "Email provider credentials are unavailable", false);
    }
  }
  return new ProviderSendError("PROVIDER_NETWORK_ERROR", "Email delivery failed", true);
}

function safeErrorMessage(error: ProviderSendError, credentials: Record<string, string>) {
  let message = error.message;
  for (const secret of Object.values(credentials)) {
    if (secret.length >= 4) message = message.split(secret).join("[redacted]");
  }
  return message.slice(0, 500);
}

async function adapterFor(options: OutboxProcessorOptions, account: EmailAccount, credentials: Record<string, string>) {
  if (options.adapterForAccount) return options.adapterForAccount(account, credentials);
  if (account.provider !== "resend") {
    throw new ProviderSendError("PROVIDER_INVALID_REQUEST", "Email provider is not configured", false);
  }
  const apiKey = credentials.apiKey;
  if (!apiKey) throw new ProviderSendError("PROVIDER_AUTH_FAILED", "Email provider credentials are invalid", false);
  return new ResendEmailProvider({ apiKey });
}

function accountFor(accounts: EmailAccount[], item: EmailOutboxItem) {
  const account = accounts.find((candidate) => candidate.id === item.accountId && candidate.companyId === item.companyId);
  if (!account || account.status !== "active") {
    throw new ProviderSendError("PROVIDER_INVALID_REQUEST", "Email account is unavailable", false);
  }
  return account;
}

export async function processEmailOutbox(options: OutboxProcessorOptions) {
  const clock = options.clock || (() => new Date());
  const now = options.now || clock();
  const leaseDuration = options.leaseDurationMs ?? OUTBOX_LEASE_DURATION_MS;
  const leasedUntil = new Date(now.getTime() + leaseDuration).toISOString();
  const items = await options.repository.leaseOutbox({
    now: now.toISOString(),
    leasedUntil,
    limit: Math.max(1, Math.min(options.limit || 50, 100)),
  });
  const credentialsKey = items.length > 0 ? (options.credentialsKey || requireEmailCredentialsKey()) : undefined;
  const results: Array<{ id: string; status: string; externalId?: string | null; errorCode?: string | null }> = [];

  for (const item of items) {
    let deliveryCredentials: Record<string, string> = {};
    try {
      const accounts = await options.repository.listAccounts(item.companyId);
      const account = accountFor(accounts, item);
      const credentials = await openEmailAccountCredentials(account, credentialsKey!);
      deliveryCredentials = credentials;
      const adapter = await adapterFor(options, account, credentials);
      const payload = sendPayload(objectValue(item.payload), account, item.idempotencyKey);
      const sent = await adapter.send(payload);
      const updated = await options.repository.markOutbox(item.companyId, item.id, {
        status: "sent",
        externalId: sent.externalId,
        leasedUntil: null,
        lastErrorCode: null,
        lastError: null,
      });
      results.push({ id: item.id, status: updated?.status || "sent", externalId: sent.externalId });
    } catch (error) {
      const providerError = failure(error);
      const attemptCount = item.attemptCount + 1;
      const canRetry = providerError.retryable && attemptCount < OUTBOX_MAX_ATTEMPTS;
      const nextAttemptAt = canRetry
        ? new Date(now.getTime() + OUTBOX_RETRY_DELAYS_MS[Math.min(attemptCount - 1, OUTBOX_RETRY_DELAYS_MS.length - 1)]).toISOString()
        : item.nextAttemptAt;
      const updated = await options.repository.markOutbox(item.companyId, item.id, {
        status: canRetry ? "retry" : "failed",
        attemptCount,
        nextAttemptAt,
        leasedUntil: null,
        lastErrorCode: providerError.code,
        lastError: safeErrorMessage(providerError, deliveryCredentials),
      });
      results.push({ id: item.id, status: updated?.status || (canRetry ? "retry" : "failed"), errorCode: providerError.code });
    }
  }

  return results;
}

export const processOutbox = processEmailOutbox;
export const runOutboxOnce = processEmailOutbox;
export const processOutboxBatch = processEmailOutbox;

export function createOutboxItem(input: Omit<EmailOutboxItem, "id" | "createdAt" | "updatedAt" | "attemptCount" | "status" | "nextAttemptAt" | "leasedUntil" | "externalId" | "lastErrorCode" | "lastError"> & Partial<Pick<EmailOutboxItem, "id" | "createdAt" | "updatedAt" | "attemptCount" | "status" | "nextAttemptAt" | "leasedUntil" | "externalId" | "lastErrorCode" | "lastError">>) {
  const now = new Date().toISOString();
  return {
    ...input,
    id: input.id || randomUUID(),
    status: input.status || "pending",
    attemptCount: input.attemptCount || 0,
    nextAttemptAt: input.nextAttemptAt || now,
    leasedUntil: input.leasedUntil || null,
    externalId: input.externalId || null,
    lastErrorCode: input.lastErrorCode || null,
    lastError: input.lastError || null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  } satisfies EmailOutboxItem;
}

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { BusinessError } from "@/lib/business/errors";
import { assertCollectable, toMinorUnits } from "./money";
import { aggregateOrderPaymentStatus } from "./state";
import type { NormalizedPaymentEvent, PaymentAccount, PaymentAttempt, PaymentProvider, PaymentProviderAdapter, PaymentRequest, PublicPaymentView } from "./types";
import type { PaymentRepository } from "./repository";
import { createPublicAccountId, parsePaymentAccountInput, requirePaymentCredentialsKey, sealPaymentCredentials } from "./config";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createPaymentAccount(repository: PaymentRepository, companyId: string, input: unknown, key = requirePaymentCredentialsKey()) {
  const parsed = parsePaymentAccountInput(input);
  const id = randomUUID();
  const account: PaymentAccount = { id, companyId, provider: parsed.provider, displayName: parsed.displayName, publicAccountId: createPublicAccountId(), encryptedCredentials: JSON.stringify(await sealPaymentCredentials(parsed.credentials, key, companyId, id)), credentialsConfigured: true, status: "active", healthStatus: "unknown", lastError: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return repository.createAccount(account);
}

export async function updatePaymentAccount(repository: PaymentRepository, companyId: string, id: string, input: unknown, key = requirePaymentCredentialsKey()) {
  const parsed = parsePaymentAccountInput(input);
  const current = (await repository.listAccounts(companyId)).find((account) => account.id === id);
  if (!current) throw new BusinessError("NOT_FOUND", "Payment account not found", 404);
  if (parsed.provider !== current.provider) throw new BusinessError("VALIDATION_ERROR", "Payment account provider cannot be changed", 400);
  return repository.updateAccount(companyId, id, { displayName: parsed.displayName, encryptedCredentials: JSON.stringify(await sealPaymentCredentials(parsed.credentials, key, companyId, id)), credentialsConfigured: true, healthStatus: "unknown", lastError: null });
}

export async function createPaymentRequest(repository: PaymentRepository, input: { companyId: string; userId: string; orderId: string; amount: string | number; currency: string; description?: string; expiresAt?: string }) {
  const order = await repository.getOrder(input.companyId, input.orderId);
  if (!order) throw new BusinessError("NOT_FOUND", "Order not found", 404);
  const currency = input.currency.trim().toUpperCase();
  if (currency !== order.currency.toUpperCase()) throw new BusinessError("VALIDATION_ERROR", "Payment currency does not match the order", 400);
  const amountMinor = toMinorUnits(input.amount, currency);
  const totalMinor = toMinorUnits(order.totalAmount, currency);
  const requests = await repository.listRequestsForOrder(input.companyId, input.orderId);
  const paid = order.amountPaidMinor;
  const pending = requests
    .filter((request) => ["pending", "requires_action"].includes(request.status) && new Date(request.expiresAt).getTime() > Date.now())
    .reduce((sum, request) => sum + request.amountMinor, 0);
  assertCollectable({ paid, pending, total: totalMinor, requested: amountMinor });
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const request: PaymentRequest = { id: randomUUID(), companyId: input.companyId, orderId: input.orderId, amountMinor, currency, description: input.description?.trim().slice(0, 500) || `Payment for order ${order.orderNo}`, publicTokenHash: tokenHash(token), expiresAt: input.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: "pending", createdBy: input.userId, createdAt: now, updatedAt: now };
  const stored = await repository.createRequest(request);
  return { request: stored, token };
}

export async function getPublicPayment(repository: PaymentRepository, token: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  const request = await repository.getRequestByTokenHash(tokenHash(token));
  if (!request || new Date(request.expiresAt).getTime() <= Date.now()) return null;
  const order = await repository.getOrder(request.companyId, request.orderId);
  if (!order) return null;
  const providers = (await repository.listAccounts(request.companyId)).filter((account) => account.status === "active" && account.credentialsConfigured).map((account) => account.provider);
  return { token, orderNo: order.orderNo, merchantName: order.merchantName, amountMinor: request.amountMinor, currency: request.currency, description: request.description, expiresAt: request.expiresAt, providers: [...new Set(providers)], status: request.status } satisfies PublicPaymentView;
}

export async function startPayment(repository: PaymentRepository, input: { request: PaymentRequest; publicToken: string; account: PaymentAccount; adapter: PaymentProviderAdapter; idempotencyKey: string; baseUrl: string }) {
  if (input.request.status === "paid" || new Date(input.request.expiresAt).getTime() <= Date.now()) throw new BusinessError("CONFLICT", "Payment request is no longer payable", 409);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(input.publicToken) || tokenHash(input.publicToken) !== input.request.publicTokenHash) throw new BusinessError("VALIDATION_ERROR", "Payment token does not match the request", 400);
  const existing = await repository.findAttemptByIdempotency(input.request.companyId, input.idempotencyKey);
  if (existing) {
    if (existing.requestId !== input.request.id || existing.paymentAccountId !== input.account.id) {
      throw new BusinessError("CONFLICT", "Payment idempotency key does not match this request", 409);
    }
    return existing;
  }
  const activeAttempt = (await repository.listAttempts(input.request.companyId, input.request.id)).find((attempt) => attempt.paymentAccountId === input.account.id && ["pending", "requires_action"].includes(attempt.status));
  if (activeAttempt) return activeAttempt;
  const now = new Date().toISOString();
  const order = await repository.getOrder(input.request.companyId, input.request.orderId);
  if (!order) throw new BusinessError("NOT_FOUND", "Order not found", 404);
  const attempt = await repository.createAttempt({ id: randomUUID(), companyId: input.request.companyId, requestId: input.request.id, paymentAccountId: input.account.id, provider: input.account.provider, idempotencyKey: input.idempotencyKey, providerTransactionId: null, paymentUrl: null, codeUrl: null, amountMinor: input.request.amountMinor, currency: input.request.currency, status: "pending", failureCode: null, expiresAt: input.request.expiresAt, createdAt: now, updatedAt: now });
  try {
    const baseUrl = input.baseUrl.replace(/\/$/, "");
    const result = await input.adapter.createCheckout({ paymentRequestId: input.request.id, paymentAttemptId: attempt.id, amountMinor: attempt.amountMinor, currency: attempt.currency, description: input.request.description, orderReference: order.orderNo, successUrl: `${baseUrl}/pay/${input.publicToken}`, cancelUrl: `${baseUrl}/pay/${input.publicToken}`, webhookUrl: `${baseUrl}/api/webhooks/payments/${input.account.provider}/${input.account.publicAccountId}`, idempotencyKey: input.idempotencyKey });
    const status = result.paymentUrl || result.codeUrl ? "requires_action" : "pending";
    await repository.updateRequest(input.request.companyId, input.request.id, { status });
    const updated = await repository.updateAttempt(input.request.companyId, attempt.id, { providerTransactionId: result.providerTransactionId || null, paymentUrl: result.paymentUrl || null, codeUrl: result.codeUrl || null, status, expiresAt: result.expiresAt || attempt.expiresAt });
    if (!updated) throw new BusinessError("CONFLICT", "Payment attempt could not be updated", 409);
    return updated;
  } catch (error) {
    await repository.updateAttempt(input.request.companyId, attempt.id, { status: "failed", failureCode: error instanceof Error ? error.name.slice(0, 100) : "PROVIDER_ERROR" });
    throw error;
  }
}

export async function applyPaymentEvent(repository: PaymentRepository, event: NormalizedPaymentEvent, context: { companyId: string; requestId?: string; provider?: PaymentProvider }) {
  const hash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
  const provider = context.provider || "stripe";
  const recorded = await repository.recordProviderEvent({ id: randomUUID(), companyId: context.companyId, provider, providerEventId: event.providerEventId, payloadHash: hash, receivedAt: new Date().toISOString(), processedAt: null });
  if (recorded.event.companyId !== context.companyId || recorded.event.payloadHash !== hash) throw new BusinessError("CONFLICT", "Payment event does not match the original payload", 409);
  if (!recorded.created && recorded.event.processedAt) return { duplicate: true, event: recorded.event };
  let attempt: PaymentAttempt | null = null;
  if (event.attemptId) attempt = await repository.getAttempt(context.companyId, event.attemptId);
  if (!attempt && context.requestId) {
    const candidates = await repository.listAttempts(context.companyId, context.requestId);
    attempt = candidates.find((candidate) => !event.providerTransactionId || candidate.providerTransactionId === event.providerTransactionId) || null;
  }
  if (!attempt && event.providerTransactionId) {
    attempt = await repository.findAttemptByProviderTransaction(context.companyId, provider, event.providerTransactionId);
  }
  if (!attempt) throw new BusinessError("VALIDATION_ERROR", "Payment event does not identify an attempt", 400);
  if (attempt.provider !== provider) throw new BusinessError("VALIDATION_ERROR", "Payment event provider does not match", 400);
  const request = await repository.getRequest(context.companyId, attempt.requestId);
  if (!request || (context.requestId && request.id !== context.requestId)) throw new BusinessError("VALIDATION_ERROR", "Payment event request does not match", 400);
  const order = await repository.getOrder(context.companyId, request.orderId);
  if (!order || (event.orderReference && event.orderReference !== order.orderNo)) throw new BusinessError("VALIDATION_ERROR", "Payment event order does not match", 400);
  if (attempt && event.kind === "payment_succeeded") {
    if (!Number.isSafeInteger(event.amountMinor) || event.amountMinor !== attempt.amountMinor) throw new BusinessError("VALIDATION_ERROR", "Payment event amount does not match", 400);
    if (!event.currency || event.currency.toUpperCase() !== attempt.currency.toUpperCase()) throw new BusinessError("VALIDATION_ERROR", "Payment event currency does not match", 400);
    await repository.updateAttempt(context.companyId, attempt.id, { status: "paid", providerTransactionId: event.providerTransactionId || attempt.providerTransactionId });
    await repository.updateRequest(context.companyId, request.id, { status: "paid" });
    await recalculateOrderPayment(repository, context.companyId, request.orderId);
  } else if (attempt && event.kind === "payment_failed") {
    await repository.updateAttempt(context.companyId, attempt.id, { status: "failed", failureCode: "PROVIDER_PAYMENT_FAILED" });
    await repository.updateRequest(context.companyId, attempt.requestId, { status: "failed" });
  } else if (event.kind === "refund_succeeded" || event.kind === "refund_failed") {
    if (event.refundAmountMinor !== undefined && (!Number.isSafeInteger(event.refundAmountMinor) || event.refundAmountMinor <= 0)) throw new BusinessError("VALIDATION_ERROR", "Refund event amount is invalid", 400);
    const refunds = (await repository.listRefunds(context.companyId, request.id)).filter((refund) => refund.attemptId === attempt.id);
    let refund = event.refundId ? refunds.find((candidate) => candidate.providerRefundId === event.refundId) : undefined;
    if (!refund) {
      const pending = refunds.filter((candidate) => candidate.status === "pending" && (event.refundAmountMinor === undefined || candidate.amountMinor === event.refundAmountMinor));
      if (pending.length === 1) refund = pending[0];
    }
    if (!refund) throw new BusinessError("VALIDATION_ERROR", "Refund event does not identify a refund", 400);
    if (event.refundAmountMinor !== undefined && event.refundAmountMinor !== refund.amountMinor) throw new BusinessError("VALIDATION_ERROR", "Refund event amount does not match", 400);
    await repository.updateRefund(context.companyId, refund.id, {
      status: event.kind === "refund_succeeded" ? "succeeded" : "failed",
      providerRefundId: event.refundId || refund.providerRefundId,
    });
    await recalculateOrderPayment(repository, context.companyId, request.orderId);
  }
  await repository.markProviderEventProcessed(provider, event.providerEventId);
  return { duplicate: false, event: recorded.event, attempt };
}

async function recalculateOrderPayment(repository: PaymentRepository, companyId: string, orderId: string) {
  const order = await repository.getOrder(companyId, orderId);
  if (!order) throw new BusinessError("NOT_FOUND", "Order not found", 404);
  const attempts = await repository.listAttemptsForOrder(companyId, orderId);
  const paidMinor = attempts.filter((attempt) => attempt.status === "paid").reduce((sum, attempt) => sum + attempt.amountMinor, 0);
  const requestIds = [...new Set(attempts.map((attempt) => attempt.requestId))];
  let refundedMinor = 0;
  for (const requestId of requestIds) refundedMinor += (await repository.listRefunds(companyId, requestId)).filter((refund) => refund.status === "succeeded").reduce((sum, refund) => sum + refund.amountMinor, 0);
  const netPaidMinor = Math.max(0, paidMinor - refundedMinor);
  const totalMinor = toMinorUnits(order.totalAmount, order.currency);
  await repository.updateOrderPayment(companyId, orderId, aggregateOrderPaymentStatus(totalMinor, paidMinor, refundedMinor), netPaidMinor);
}

export async function createRefund(repository: PaymentRepository, input: { companyId: string; userId: string; requestId: string; attemptId: string; amountMinor: number; reason: string; idempotencyKey: string; adapter: PaymentProviderAdapter }) {
  const attempt = await repository.getAttempt(input.companyId, input.attemptId);
  if (!attempt || attempt.requestId !== input.requestId || attempt.status !== "paid" || !attempt.providerTransactionId) throw new BusinessError("CONFLICT", "Payment attempt is not refundable", 409);
  const refunds = await repository.listRefunds(input.companyId, input.requestId);
  const refundable = attempt.amountMinor - refunds.filter((refund) => ["pending", "succeeded"].includes(refund.status)).reduce((sum, refund) => sum + refund.amountMinor, 0);
  if (input.amountMinor <= 0 || input.amountMinor > refundable) throw new BusinessError("CONFLICT", "Refund amount exceeds the refundable balance", 409);
  const refund = await repository.createRefund({ id: randomUUID(), companyId: input.companyId, requestId: input.requestId, attemptId: input.attemptId, amountMinor: input.amountMinor, reason: input.reason.trim().slice(0, 500), providerRefundId: null, status: "pending", idempotencyKey: input.idempotencyKey, createdBy: input.userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  try {
    const result = await input.adapter.refund({ providerTransactionId: attempt.providerTransactionId, amountMinor: refund.amountMinor, totalAmountMinor: attempt.amountMinor, currency: attempt.currency, idempotencyKey: refund.idempotencyKey });
    const updated = await repository.updateRefund(input.companyId, refund.id, { status: "succeeded", providerRefundId: result.providerRefundId });
    const request = await repository.getRequest(input.companyId, input.requestId);
    if (request) await recalculateOrderPayment(repository, input.companyId, request.orderId);
    return updated;
  } catch { return repository.updateRefund(input.companyId, refund.id, { status: "failed" }); }
}

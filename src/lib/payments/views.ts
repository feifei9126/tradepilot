import type { PaymentAccount, PaymentAttempt, PaymentRefund, PaymentRequest } from "./types";

export function toPaymentAccountView(account: PaymentAccount) {
  return { id: account.id, companyId: account.companyId, provider: account.provider, displayName: account.displayName, publicAccountId: account.publicAccountId, credentialsConfigured: account.credentialsConfigured, status: account.status, healthStatus: account.healthStatus, lastError: account.lastError, createdAt: account.createdAt, updatedAt: account.updatedAt };
}

export function toPaymentRequestView(request: PaymentRequest) { return { id: request.id, orderId: request.orderId, amountMinor: request.amountMinor, currency: request.currency, description: request.description, expiresAt: request.expiresAt, status: request.status, createdAt: request.createdAt }; }
export function toPaymentAttemptView(attempt: PaymentAttempt) { return { id: attempt.id, provider: attempt.provider, providerTransactionId: attempt.providerTransactionId, paymentUrl: attempt.paymentUrl, codeUrl: attempt.codeUrl, amountMinor: attempt.amountMinor, currency: attempt.currency, status: attempt.status, failureCode: attempt.failureCode, expiresAt: attempt.expiresAt, createdAt: attempt.createdAt }; }
export function toPaymentRefundView(refund: PaymentRefund) { return { id: refund.id, amountMinor: refund.amountMinor, reason: refund.reason, providerRefundId: refund.providerRefundId, status: refund.status, createdAt: refund.createdAt }; }

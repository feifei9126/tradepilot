export type PaymentProvider = "stripe" | "alipay" | "wechat";
export type PaymentAccountStatus = "active" | "disabled";
export type PaymentHealthStatus = "unknown" | "healthy" | "error";
export type PaymentRequestStatus = "pending" | "requires_action" | "paid" | "failed" | "cancelled" | "expired";
export type PaymentAttemptStatus = "pending" | "requires_action" | "paid" | "failed" | "cancelled" | "expired";
export type OrderPaymentStatus = "unpaid" | "partial" | "paid" | "partially_refunded" | "refunded";
export type RefundStatus = "pending" | "succeeded" | "failed" | "cancelled";

export interface PaymentAccount {
  id: string;
  companyId: string;
  provider: PaymentProvider;
  displayName: string;
  publicAccountId: string;
  encryptedCredentials: string | null;
  credentialsConfigured: boolean;
  status: PaymentAccountStatus;
  healthStatus: PaymentHealthStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequest {
  id: string;
  companyId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  description: string;
  publicTokenHash: string;
  expiresAt: string;
  status: PaymentRequestStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAttempt {
  id: string;
  companyId: string;
  requestId: string;
  paymentAccountId: string;
  provider: PaymentProvider;
  idempotencyKey: string;
  providerTransactionId: string | null;
  paymentUrl: string | null;
  codeUrl: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentAttemptStatus;
  failureCode: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProviderEvent {
  id: string;
  companyId: string;
  provider: PaymentProvider;
  providerEventId: string;
  payloadHash: string;
  receivedAt: string;
  processedAt: string | null;
}

export interface PaymentRefund {
  id: string;
  companyId: string;
  requestId: string;
  attemptId: string;
  amountMinor: number;
  reason: string;
  providerRefundId: string | null;
  status: RefundStatus;
  idempotencyKey: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPaymentView {
  token: string;
  orderNo: string;
  merchantName: string;
  amountMinor: number;
  currency: string;
  description: string;
  expiresAt: string;
  providers: PaymentProvider[];
  status: PaymentRequestStatus;
}

export interface NormalizedPaymentEvent {
  providerEventId: string;
  kind: "payment_succeeded" | "payment_failed" | "refund_succeeded" | "refund_failed";
  attemptId?: string;
  providerTransactionId?: string;
  amountMinor?: number;
  currency?: string;
  orderReference?: string;
  refundId?: string;
  refundAmountMinor?: number;
}

export interface CreateCheckoutInput {
  paymentRequestId: string;
  paymentAttemptId: string;
  amountMinor: number;
  currency: string;
  description: string;
  orderReference: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  idempotencyKey: string;
}

export interface CreateCheckoutResult {
  providerTransactionId?: string;
  paymentUrl?: string;
  codeUrl?: string;
  expiresAt?: string;
}

export interface PaymentProviderAdapter {
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyWebhook(rawBody: string, headers: Headers | Record<string, string>): Promise<NormalizedPaymentEvent[]>;
  refund(input: { providerTransactionId: string; amountMinor: number; currency: string; idempotencyKey: string }): Promise<{ providerRefundId: string }>;
}

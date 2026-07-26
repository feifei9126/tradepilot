import { ProviderSendError } from "@/lib/email/providers/contracts";
import type { CreateCheckoutInput, CreateCheckoutResult, NormalizedPaymentEvent, PaymentProviderAdapter } from "../types";
import { verifyStripeSignature } from "../signatures/stripe";

export interface StripeProviderOptions { secretKey: string; webhookSecret: string; fetch?: typeof globalThis.fetch; endpoint?: string; }

export class StripePaymentProvider implements PaymentProviderAdapter {
  private readonly options: StripeProviderOptions;
  constructor(options: StripeProviderOptions) { this.options = options; }
  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const body = new URLSearchParams({ mode: "payment", "line_items[0][price_data][currency]": input.currency.toLowerCase(), "line_items[0][price_data][product_data][name]": input.description, "line_items[0][price_data][unit_amount]": String(input.amountMinor), "line_items[0][quantity]": "1", success_url: input.successUrl, cancel_url: input.cancelUrl, "metadata[paymentRequestId]": input.paymentRequestId, "metadata[paymentAttemptId]": input.paymentAttemptId, "metadata[orderReference]": input.orderReference });
    const response = await (this.options.fetch || globalThis.fetch)(this.options.endpoint || "https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${this.options.secretKey}:`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": input.idempotencyKey }, body });
    if (!response.ok) throw new ProviderSendError(response.status >= 500 || response.status === 429 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_INVALID_REQUEST", "Stripe checkout request failed", response.status >= 500 || response.status === 429, response.status);
    const json = await response.json() as Record<string, unknown>;
    const id = typeof json.id === "string" ? json.id : "";
    const url = typeof json.url === "string" ? json.url : "";
    if (!id || !url) throw new ProviderSendError("PROVIDER_RESPONSE_INVALID", "Stripe checkout response is invalid", false);
    return { providerTransactionId: id, paymentUrl: url };
  }
  async verifyWebhook(rawBody: string, headers: Headers | Record<string, string>): Promise<NormalizedPaymentEvent[]> {
    if (!verifyStripeSignature(rawBody, headers, this.options.webhookSecret)) throw new ProviderSendError("PROVIDER_AUTH_FAILED", "Stripe webhook signature is invalid", false, 401);
    const payload = JSON.parse(rawBody) as { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
    const object = payload.data?.object || {};
    const metadata = object.metadata && typeof object.metadata === "object" ? object.metadata as Record<string, unknown> : {};
    if (payload.type === "checkout.session.completed") return [{ providerEventId: payload.id || "", kind: "payment_succeeded", attemptId: typeof metadata.paymentAttemptId === "string" ? metadata.paymentAttemptId : undefined, providerTransactionId: typeof object.payment_intent === "string" ? object.payment_intent : typeof object.id === "string" ? object.id : undefined, amountMinor: typeof object.amount_total === "number" ? object.amount_total : undefined, currency: typeof object.currency === "string" ? object.currency.toUpperCase() : undefined, orderReference: typeof metadata.orderReference === "string" ? metadata.orderReference : undefined }];
    if (payload.type === "payment_intent.payment_failed") return [{ providerEventId: payload.id || "", kind: "payment_failed", attemptId: typeof metadata.paymentAttemptId === "string" ? metadata.paymentAttemptId : undefined, providerTransactionId: typeof object.id === "string" ? object.id : undefined, orderReference: typeof metadata.orderReference === "string" ? metadata.orderReference : undefined }];
    if (payload.type === "charge.refunded") return [{ providerEventId: payload.id || "", kind: "refund_succeeded", providerTransactionId: typeof object.payment_intent === "string" ? object.payment_intent : undefined, refundAmountMinor: typeof object.amount_refunded === "number" ? object.amount_refunded : undefined }];
    return [];
  }
  async refund(input: { providerTransactionId: string; amountMinor: number; currency: string; idempotencyKey: string }) {
    const response = await (this.options.fetch || globalThis.fetch)(this.options.endpoint?.replace(/checkout\/sessions$/, "refunds") || "https://api.stripe.com/v1/refunds", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${this.options.secretKey}:`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": input.idempotencyKey }, body: new URLSearchParams({ payment_intent: input.providerTransactionId, amount: String(input.amountMinor) }) });
    if (!response.ok) throw new ProviderSendError(response.status >= 500 || response.status === 429 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_INVALID_REQUEST", "Stripe refund request failed", response.status >= 500 || response.status === 429, response.status);
    const json = await response.json() as Record<string, unknown>; if (typeof json.id !== "string") throw new ProviderSendError("PROVIDER_RESPONSE_INVALID", "Stripe refund response is invalid", false); return { providerRefundId: json.id };
  }
}

import { ProviderSendError } from "@/lib/email/providers/contracts";
import type { CreateCheckoutInput, CreateCheckoutResult, NormalizedPaymentEvent, PaymentProviderAdapter } from "../types";
import { signAlipay, verifyAlipay } from "../signatures/alipay";
import { toMinorUnits } from "../money";

export interface AlipayProviderOptions { appId: string; privateKey: string; publicKey: string; sellerId?: string; gateway?: string; fetch?: typeof globalThis.fetch; }

function amount(minor: number) { return (minor / 100).toFixed(2); }

export class AlipayPaymentProvider implements PaymentProviderAdapter {
  constructor(private readonly options: AlipayProviderOptions) {}
  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const params: Record<string, string> = { app_id: this.options.appId, method: "alipay.trade.page.pay", format: "JSON", charset: "utf-8", sign_type: "RSA2", timestamp: new Date().toISOString().replace("T", " ").slice(0, 19), version: "1.0", notify_url: input.webhookUrl, biz_content: JSON.stringify({ out_trade_no: input.paymentAttemptId, merchant_order_no: input.orderReference, product_code: "FAST_INSTANT_TRADE_PAY", total_amount: amount(input.amountMinor), subject: input.description }), return_url: input.successUrl };
    params.sign = signAlipay(params, this.options.privateKey);
    const url = `${this.options.gateway || "https://openapi.alipay.com/gateway.do"}?${new URLSearchParams(params).toString()}`;
    return { providerTransactionId: input.orderReference, paymentUrl: url };
  }
  async verifyWebhook(rawBody: string): Promise<NormalizedPaymentEvent[]> {
    const params = Object.fromEntries(new URLSearchParams(rawBody).entries());
    if (!verifyAlipay(params, this.options.publicKey)) throw new ProviderSendError("PROVIDER_AUTH_FAILED", "Alipay webhook signature is invalid", false, 401);
    if (params.trade_status !== "TRADE_SUCCESS") return [];
    return [{ providerEventId: params.notify_id || params.trade_no || params.out_trade_no || "", kind: "payment_succeeded", attemptId: params.out_trade_no, providerTransactionId: params.trade_no, amountMinor: toMinorUnits(params.total_amount || "", params.currency || "CNY"), currency: params.currency || "CNY", orderReference: params.merchant_order_no }];
  }
  async refund(input: { providerTransactionId: string; amountMinor: number; currency: string; idempotencyKey: string }) {
    const params: Record<string, string> = { app_id: this.options.appId, method: "alipay.trade.refund", format: "JSON", charset: "utf-8", sign_type: "RSA2", timestamp: new Date().toISOString().replace("T", " ").slice(0, 19), version: "1.0", biz_content: JSON.stringify({ trade_no: input.providerTransactionId, refund_amount: amount(input.amountMinor), out_request_no: input.idempotencyKey }) };
    params.sign = signAlipay(params, this.options.privateKey);
    const response = await (this.options.fetch || globalThis.fetch)(this.options.gateway || "https://openapi.alipay.com/gateway.do", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
    if (!response.ok) throw new ProviderSendError(response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_INVALID_REQUEST", "Alipay refund request failed", response.status >= 500, response.status);
    const json = await response.json() as Record<string, unknown>;
    const responseBody = json.alipay_trade_refund_response as Record<string, unknown> | undefined;
    if (!responseBody || responseBody.code !== "10000") throw new ProviderSendError("PROVIDER_INVALID_REQUEST", "Alipay refund was rejected", false);
    return { providerRefundId: String(responseBody.trade_no || input.idempotencyKey) };
  }
}

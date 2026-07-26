import { ProviderSendError } from "@/lib/email/providers/contracts";
import type { CreateCheckoutInput, CreateCheckoutResult, NormalizedPaymentEvent, PaymentProviderAdapter } from "../types";
import { decryptWechatResource, signWechatRequest, verifyWechatCallback } from "../signatures/wechat";

export interface WechatPaymentProviderOptions { mchId: string; appId: string; serial: string; privateKey: string; platformPublicKey: string; apiV3Key: string; fetch?: typeof globalThis.fetch; endpoint?: string; }

function paymentAttemptReference(attemptId: string) { return attemptId.replaceAll("-", ""); }

function paymentAttemptId(reference: unknown) {
  if (typeof reference !== "string" || !/^[0-9a-fA-F]{32}$/.test(reference)) return undefined;
  const value = reference.toLowerCase();
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export class WechatPaymentProvider implements PaymentProviderAdapter {
  constructor(private readonly options: WechatPaymentProviderOptions) {}
  private async request(path: string, body: string, idempotencyKey: string) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = idempotencyKey.slice(0, 32);
    const signer = signWechatRequest("POST", path, timestamp, nonce, body, this.options.serial, this.options.privateKey);
    const authorization = signer.authorization.replace('mchid=""', `mchid="${this.options.mchId}"`);
    const response = await (this.options.fetch || globalThis.fetch)(`${this.options.endpoint || "https://api.mch.weixin.qq.com"}${path}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: authorization }, body });
    if (!response.ok) throw new ProviderSendError(response.status >= 500 || response.status === 429 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_INVALID_REQUEST", "WeChat Pay request failed", response.status >= 500 || response.status === 429, response.status);
    return response.json() as Promise<Record<string, unknown>>;
  }
  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const body = JSON.stringify({ appid: this.options.appId, mchid: this.options.mchId, description: input.description, out_trade_no: paymentAttemptReference(input.paymentAttemptId), attach: input.orderReference, notify_url: input.webhookUrl, amount: { total: input.amountMinor, currency: input.currency } });
    const response = await this.request("/v3/pay/transactions/native", body, input.idempotencyKey);
    if (typeof response.code_url !== "string") throw new ProviderSendError("PROVIDER_RESPONSE_INVALID", "WeChat Pay response is invalid", false);
    return { providerTransactionId: paymentAttemptReference(input.paymentAttemptId), codeUrl: response.code_url };
  }
  async verifyWebhook(rawBody: string, headers: Headers | Record<string, string>): Promise<NormalizedPaymentEvent[]> {
    if (!verifyWechatCallback("POST", "/v3/pay/transactions", rawBody, headers, this.options.platformPublicKey)) throw new ProviderSendError("PROVIDER_AUTH_FAILED", "WeChat Pay webhook signature is invalid", false, 401);
    const data = JSON.parse(rawBody) as { id?: string; event_type?: string; resource?: { nonce?: string; associated_data?: string; ciphertext?: string } };
    if (!data.resource?.ciphertext || !data.resource.nonce) return [];
    const decrypted = JSON.parse(decryptWechatResource(data.resource.ciphertext, data.resource.nonce, data.resource.associated_data || "", this.options.apiV3Key)) as Record<string, unknown>;
    if (data.event_type !== "TRANSACTION.SUCCESS") return [];
    const amount = decrypted.amount && typeof decrypted.amount === "object" ? decrypted.amount as Record<string, unknown> : {};
    return [{ providerEventId: data.id || String(decrypted.transaction_id || decrypted.out_trade_no || ""), kind: "payment_succeeded", attemptId: paymentAttemptId(decrypted.out_trade_no), providerTransactionId: typeof decrypted.transaction_id === "string" ? decrypted.transaction_id : undefined, amountMinor: typeof amount.total === "number" ? amount.total : undefined, currency: typeof amount.currency === "string" ? amount.currency : undefined, orderReference: typeof decrypted.attach === "string" ? decrypted.attach : undefined }];
  }
  async refund(input: { providerTransactionId: string; amountMinor: number; totalAmountMinor: number; currency: string; idempotencyKey: string }) {
    const body = JSON.stringify({ transaction_id: input.providerTransactionId, out_refund_no: input.idempotencyKey, amount: { refund: input.amountMinor, total: input.totalAmountMinor, currency: input.currency } });
    const response = await this.request("/v3/refund/domestic/refunds", body, input.idempotencyKey);
    if (typeof response.refund_id !== "string") throw new ProviderSendError("PROVIDER_RESPONSE_INVALID", "WeChat refund response is invalid", false);
    return { providerRefundId: response.refund_id };
  }
}

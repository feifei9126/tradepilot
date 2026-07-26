import { BusinessError } from "@/lib/business/errors";
import type { PaymentProvider, PaymentProviderAdapter } from "../types";
import { AlipayPaymentProvider } from "./alipay";
import { StripePaymentProvider } from "./stripe";
import { WechatPaymentProvider } from "./wechat";

function required(credentials: Record<string, string>, key: string) {
  const value = credentials[key]?.trim();
  if (!value) throw new BusinessError("PROVIDER_NOT_CONFIGURED", `Payment credential ${key} is missing`, 503);
  return value;
}

export function createPaymentProvider(provider: PaymentProvider, credentials: Record<string, string>): PaymentProviderAdapter {
  if (provider === "stripe") {
    return new StripePaymentProvider({
      secretKey: required(credentials, "secretKey"),
      webhookSecret: required(credentials, "webhookSecret"),
    });
  }
  if (provider === "alipay") {
    return new AlipayPaymentProvider({
      appId: required(credentials, "appId"),
      privateKey: required(credentials, "privateKey"),
      publicKey: required(credentials, "publicKey"),
      sellerId: credentials.sellerId?.trim() || undefined,
    });
  }
  if (provider === "wechat") {
    return new WechatPaymentProvider({
      mchId: required(credentials, "mchId"),
      appId: required(credentials, "appId"),
      serial: required(credentials, "serial"),
      privateKey: required(credentials, "privateKey"),
      platformPublicKey: required(credentials, "platformPublicKey"),
      apiV3Key: required(credentials, "apiV3Key"),
    });
  }
  throw new BusinessError("VALIDATION_ERROR", "Payment provider is invalid", 400);
}

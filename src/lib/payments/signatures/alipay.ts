import { createVerify, createSign } from "node:crypto";
import { BusinessError } from "@/lib/business/errors";

export function alipaySignContent(params: Record<string, string>) {
  return Object.keys(params).filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "" && params[key] !== undefined).sort().map((key) => `${key}=${params[key]}`).join("&");
}

export function signAlipay(params: Record<string, string>, privateKey: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(alipaySignContent(params), "utf8");
  return signer.sign(privateKey, "base64");
}

export function verifyAlipay(params: Record<string, string>, publicKey: string) {
  const sign = params.sign;
  if (!sign) return false;
  const verifier = createVerify("RSA-SHA256");
  verifier.update(alipaySignContent(params), "utf8");
  return verifier.verify(publicKey, sign, "base64");
}

export function requireAlipayNotification(params: Record<string, string>, input: { appId: string; sellerId?: string; orderNo: string; amountMinor: number; currency: string; publicKey: string }) {
  if (!verifyAlipay(params, input.publicKey)) throw new BusinessError("UNAUTHORIZED", "Alipay notification signature is invalid", 401);
  if (params.app_id !== input.appId || (input.sellerId && params.seller_id !== input.sellerId) || params.out_trade_no !== input.orderNo || params.trade_status !== "TRADE_SUCCESS") throw new BusinessError("VALIDATION_ERROR", "Alipay notification does not match the payment", 400);
  const amount = Number(params.total_amount);
  if (!Number.isFinite(amount) || Math.round(amount * 100) !== input.amountMinor || params.currency && params.currency !== input.currency) throw new BusinessError("VALIDATION_ERROR", "Alipay amount does not match the payment", 400);
}

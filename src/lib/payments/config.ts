import { randomUUID } from "node:crypto";
import { z } from "zod";
import { BusinessError } from "@/lib/business/errors";
import { openSecret, sealSecret, type SealedSecret } from "@/lib/security/envelope";
import type { PaymentProvider } from "./types";

const base = z.object({ provider: z.enum(["stripe", "alipay", "wechat"]), displayName: z.string().trim().min(1).max(120), credentials: z.record(z.string(), z.string().min(1).max(200000)) });
export type PaymentAccountInput = z.infer<typeof base>;

export function parsePaymentAccountInput(value: unknown): PaymentAccountInput {
  const parsed = base.safeParse(value);
  if (!parsed.success) throw new BusinessError("VALIDATION_ERROR", "Payment account configuration is invalid", 400, { cause: parsed.error });
  const { provider, credentials } = parsed.data;
  const required: Record<PaymentProvider, string[]> = { stripe: ["secretKey", "publishableKey", "webhookSecret"], alipay: ["appId", "privateKey", "publicKey"], wechat: ["mchId", "appId", "serial", "privateKey", "platformPublicKey", "apiV3Key"] };
  for (const key of required[provider]) if (!credentials[key]) throw new BusinessError("VALIDATION_ERROR", `Payment credential ${key} is required`, 400);
  return parsed.data;
}

export function createPublicAccountId() { return `pay_${randomUUID().replaceAll("-", "")}`; }

export async function sealPaymentCredentials(credentials: Record<string, string>, key: string | Uint8Array, companyId: string, accountId: string): Promise<SealedSecret> {
  return sealSecret(JSON.stringify(credentials), key, { companyId, recordId: accountId, purpose: "payment" });
}

export async function openPaymentCredentials(account: { companyId: string; id: string; encryptedCredentials: string | null }, key: string | Uint8Array) {
  if (!account.encryptedCredentials) throw new BusinessError("CREDENTIALS_DECRYPT_FAILED", "Payment credentials are not configured", 500);
  const parsed = JSON.parse(await openSecret(JSON.parse(account.encryptedCredentials) as SealedSecret, key, { companyId: account.companyId, recordId: account.id, purpose: "payment" })) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new BusinessError("CREDENTIALS_DECRYPT_FAILED", "Payment credentials are invalid", 500);
  return parsed as Record<string, string>;
}

export function requirePaymentCredentialsKey() {
  const value = process.env.TRADEPILOT_CREDENTIALS_KEY?.trim();
  if (!value) throw new BusinessError("CREDENTIALS_KEY_INVALID", "TRADEPILOT_CREDENTIALS_KEY is required", 500);
  return value;
}

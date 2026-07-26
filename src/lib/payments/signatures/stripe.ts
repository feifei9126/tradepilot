import { createHmac, timingSafeEqual } from "node:crypto";
import { BusinessError } from "@/lib/business/errors";

function header(headers: Headers | Record<string, string>, name: string) {
  if (headers instanceof Headers) return headers.get(name);
  return headers[name] || headers[name.toLowerCase()] || null;
}

export function verifyStripeSignature(rawBody: string, headers: Headers | Record<string, string>, secret: string, now = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  const signature = header(headers, "stripe-signature") || "";
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=", 2) as [string, string]));
  const timestamp = Number(parts.t);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > toleranceSeconds || !parts.v1) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const supplied = Buffer.from(parts.v1, "hex");
  const actual = Buffer.from(expected, "hex");
  return supplied.length === actual.length && timingSafeEqual(supplied, actual);
}

export function requireStripeSignature(rawBody: string, headers: Headers | Record<string, string>, secret: string) {
  if (!verifyStripeSignature(rawBody, headers, secret)) throw new BusinessError("UNAUTHORIZED", "Stripe webhook signature is invalid", 401);
}

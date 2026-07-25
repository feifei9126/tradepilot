import { timingSafeEqual } from "node:crypto";

export function hasValidWebhookSecret(authorization: string | null, expectedSecret: string | undefined) {
  if (!expectedSecret || !authorization?.startsWith("Bearer ")) return false;
  const suppliedSecret = authorization.slice("Bearer ".length).trim();
  const supplied = Buffer.from(suppliedSecret);
  const expected = Buffer.from(expectedSecret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

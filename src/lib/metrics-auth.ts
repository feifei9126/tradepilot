import { createHash, timingSafeEqual } from "node:crypto";

export type MetricsAuthorization = "authorized" | "unconfigured" | "unauthorized";

/**
 * Metrics are disabled unless an operator configures a high-entropy token.
 * Digesting both values keeps the comparison length constant before the
 * constant-time comparison, without ever logging or echoing either token.
 */
export function authorizeMetricsRequest(
  request: Request,
  configuredToken = process.env.METRICS_TOKEN,
): MetricsAuthorization {
  if (
    !configuredToken ||
    configuredToken.length < 32 ||
    configuredToken.trim() !== configuredToken
  ) {
    return "unconfigured";
  }

  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  const suppliedToken = match?.[1];
  if (!suppliedToken || suppliedToken.length > 4096) return "unauthorized";

  const expectedDigest = createHash("sha256").update(configuredToken).digest();
  const suppliedDigest = createHash("sha256").update(suppliedToken).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest) ? "authorized" : "unauthorized";
}

import { NextResponse } from "next/server";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { getPostgresPaymentRepository } from "@/lib/payments/runtime";
import { getPublicPayment, startPayment } from "@/lib/payments/service";
import { openPaymentCredentials, requirePaymentCredentialsKey } from "@/lib/payments/config";
import { createPaymentProvider } from "@/lib/payments/providers";
import type { PaymentProvider } from "@/lib/payments/types";
import { toPaymentAttemptView } from "@/lib/payments/views";

async function contextToken(context: { params: Promise<{ token: string }> }) { return (await context.params).token; }

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try { const repository = getPostgresPaymentRepository(); const token = await contextToken(context); const payment = await getPublicPayment(repository, token); if (!payment) throw new BusinessError("NOT_FOUND", "Payment link is invalid or expired", 404); return NextResponse.json({ payment }); } catch (error) { return businessErrorResponse(error); }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const token = await contextToken(context);
    const body = await request.json() as Record<string, unknown>;
    const provider = typeof body.provider === "string" ? body.provider as PaymentProvider : null;
    if (!provider || !["stripe", "alipay", "wechat"].includes(provider)) throw new BusinessError("VALIDATION_ERROR", "Payment provider is required", 400);
    const repository = getPostgresPaymentRepository();
    const payment = await getPublicPayment(repository, token); if (!payment) throw new BusinessError("NOT_FOUND", "Payment link is invalid or expired", 404);
    const requestRow = await repository.getRequestByTokenHash((await import("node:crypto")).createHash("sha256").update(token).digest("hex")); if (!requestRow) throw new BusinessError("NOT_FOUND", "Payment link is invalid or expired", 404);
    const account = (await repository.listAccounts(requestRow.companyId)).find((item) => item.provider === provider && item.status === "active" && item.credentialsConfigured); if (!account) throw new BusinessError("PROVIDER_NOT_CONFIGURED", "Payment provider is not configured", 503);
    const credentials = await openPaymentCredentials(account, requirePaymentCredentialsKey());
    const adapter = createPaymentProvider(provider, credentials);
    const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.length <= 255 ? body.idempotencyKey : crypto.randomUUID();
    const attempt = await startPayment(repository, { request: requestRow, publicToken: token, account, adapter, idempotencyKey, baseUrl: new URL(request.url).origin });
    return NextResponse.json({ attempt: toPaymentAttemptView(attempt) });
  } catch (error) { return businessErrorResponse(error); }
}

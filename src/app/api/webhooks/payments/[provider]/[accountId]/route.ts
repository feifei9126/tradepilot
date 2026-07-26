import { NextResponse } from "next/server";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { getPostgresPaymentRepository } from "@/lib/payments/runtime";
import { openPaymentCredentials, requirePaymentCredentialsKey } from "@/lib/payments/config";
import { applyPaymentEvent } from "@/lib/payments/service";
import { createPaymentProvider } from "@/lib/payments/providers";
import type { PaymentProvider } from "@/lib/payments/types";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ provider: string; accountId: string }> }) {
  try {
    const params = await context.params;
    const provider = params.provider as PaymentProvider;
    if (!["stripe", "alipay", "wechat"].includes(provider)) throw new BusinessError("VALIDATION_ERROR", "Payment provider is invalid", 400);
    const repository = getPostgresPaymentRepository();
    const account = await repository.findAccountByPublicId(params.accountId);
    if (!account || account.provider !== provider || account.status !== "active") throw new BusinessError("UNAUTHORIZED", "Payment account is invalid", 401);
    const credentials = await openPaymentCredentials(account, requirePaymentCredentialsKey());
    const adapter = createPaymentProvider(provider, credentials);
    const rawBody = await request.text();
    const events = await adapter.verifyWebhook(rawBody, request.headers);
    const results = [];
    for (const event of events) {
      const requestRow = event.orderReference ? await repository.findRequestByOrderReference(account.companyId, event.orderReference) : null;
      results.push(await applyPaymentEvent(repository, event, { companyId: account.companyId, requestId: requestRow?.id, provider }));
    }
    return NextResponse.json({ ok: true, events: results.length, duplicates: results.filter((item) => item.duplicate).length });
  } catch (error) { return businessErrorResponse(error); }
}

import { NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { authorizePaymentContext, getPostgresPaymentRepository } from "@/lib/payments/runtime";
import { createRefund } from "@/lib/payments/service";
import { createPaymentProvider } from "@/lib/payments/providers";
import { toPaymentRefundView } from "@/lib/payments/views";
import { openPaymentCredentials, requirePaymentCredentialsKey } from "@/lib/payments/config";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const business = await authorizePaymentContext(requireBusinessContext(request), "payments:refund"); const params = await context.params; const body = await request.json() as Record<string, unknown>; const repository = getPostgresPaymentRepository(); const requestRow = await repository.getRequest(business.companyId, params.id); if (!requestRow) throw new BusinessError("NOT_FOUND", "Payment request not found", 404); const attemptId = typeof body.attemptId === "string" ? body.attemptId : ""; const amountMinor = typeof body.amountMinor === "number" ? body.amountMinor : 0; const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : crypto.randomUUID(); const attempt = await repository.getAttempt(business.companyId, attemptId); if (!attempt) throw new BusinessError("NOT_FOUND", "Payment attempt not found", 404); const account = (await repository.listAccounts(business.companyId)).find((item) => item.id === attempt.paymentAccountId); if (!account || account.provider !== attempt.provider) throw new BusinessError("NOT_FOUND", "Payment account not found", 404); const credentials = await openPaymentCredentials(account, requirePaymentCredentialsKey()); const result = await createRefund(repository, { companyId: business.companyId, userId: business.userId, requestId: requestRow.id, attemptId, amountMinor, reason: typeof body.reason === "string" ? body.reason : "Order refund", idempotencyKey, adapter: createPaymentProvider(account.provider, credentials) }); return NextResponse.json({ refund: result && toPaymentRefundView(result) }, { status: 201 }); } catch (error) { return businessErrorResponse(error); }
}

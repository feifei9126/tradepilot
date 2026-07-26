import { NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { authorizePaymentContext, getPostgresPaymentRepository } from "@/lib/payments/runtime";
import { createPaymentRequest } from "@/lib/payments/service";
import { toPaymentAttemptView, toPaymentRequestView } from "@/lib/payments/views";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const business = await authorizePaymentContext(requireBusinessContext(request), "payments:create"); const body = await request.json() as Record<string, unknown>; const params = await context.params; if (typeof body.amount !== "string" && typeof body.amount !== "number") throw new BusinessError("VALIDATION_ERROR", "Payment amount is required", 400); const currency = typeof body.currency === "string" ? body.currency : "USD"; const result = await createPaymentRequest(getPostgresPaymentRepository(), { companyId: business.companyId, userId: business.userId, orderId: params.id, amount: body.amount, currency, description: typeof body.description === "string" ? body.description : undefined, expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined }); return NextResponse.json({ request: toPaymentRequestView(result.request), token: result.token, url: `/pay/${result.token}` }, { status: 201 }); } catch (error) { return businessErrorResponse(error); }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const business = await authorizePaymentContext(requireBusinessContext(request), "payments:create"); const params = await context.params; const repository = getPostgresPaymentRepository(); const order = await repository.getOrder(business.companyId, params.id); if (!order) throw new BusinessError("NOT_FOUND", "Order not found", 404); const attempts = await repository.listAttemptsForOrder(business.companyId, params.id); return NextResponse.json({ order: { id: order.id, orderNo: order.orderNo, currency: order.currency, totalAmount: order.totalAmount, paymentStatus: order.paymentStatus, amountPaidMinor: order.amountPaidMinor }, attempts: attempts.map(toPaymentAttemptView) }); } catch (error) { return businessErrorResponse(error); }
}

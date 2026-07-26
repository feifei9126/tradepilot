import { NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { authorizePaymentContext, getPostgresPaymentRepository } from "@/lib/payments/runtime";
import { createPaymentAccount, updatePaymentAccount } from "@/lib/payments/service";
import { toPaymentAccountView } from "@/lib/payments/views";

async function json(request: Request) { try { return await request.json() as unknown; } catch { throw new Error("invalid json"); } }

export async function GET(request: Request) {
  try { const context = await authorizePaymentContext(requireBusinessContext(request), "payments:configure"); const accounts = await getPostgresPaymentRepository().listAccounts(context.companyId); return NextResponse.json({ accounts: accounts.map(toPaymentAccountView), mode: "configured" }); } catch (error) { return businessErrorResponse(error); }
}

export async function POST(request: Request) {
  try { const context = await authorizePaymentContext(requireBusinessContext(request), "payments:configure"); const account = await createPaymentAccount(getPostgresPaymentRepository(), context.companyId, await json(request)); return NextResponse.json({ account: toPaymentAccountView(account) }, { status: 201 }); } catch (error) { return businessErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try { const context = await authorizePaymentContext(requireBusinessContext(request), "payments:configure"); const body = await json(request) as Record<string, unknown>; const id = typeof body.id === "string" ? body.id : ""; if (!id) throw new Error("invalid account id"); const account = await updatePaymentAccount(getPostgresPaymentRepository(), context.companyId, id, body); if (!account) return NextResponse.json({ error: "Payment account not found", code: "NOT_FOUND" }, { status: 404 }); return NextResponse.json({ account: toPaymentAccountView(account) }); } catch (error) { return businessErrorResponse(error); }
}

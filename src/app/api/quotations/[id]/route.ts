import { NextRequest, NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const { id } = await context.params;
    const quotation = await repository.quotations.get(id);
    if (!quotation)
      return NextResponse.json({ error: "报价不存在" }, { status: 404 });
    return NextResponse.json(quotation);
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const { id } = await context.params;
    const body = await req.json();
    const allowedStatuses = new Set([
      "draft",
      "sent",
      "accepted",
      "rejected",
      "expired",
    ]);
    if (typeof body.status !== "string" || !allowedStatuses.has(body.status)) {
      return NextResponse.json({ error: "报价状态无效" }, { status: 400 });
    }
    return NextResponse.json(
      await repository.quotations.updateStatus(id, body.status),
    );
  } catch (error) {
    return businessErrorResponse(error);
  }
}

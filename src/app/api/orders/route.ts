import { NextRequest, NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";
import { isValidIsoDate } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    return NextResponse.json(await repository.orders.list());
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const body = await req.json();
    const quotationId =
      typeof body.quotationId === "string" ? body.quotationId.trim() : "";
    const deliveryDate =
      typeof body.deliveryDate === "string" ? body.deliveryDate.trim() : "";
    if (!quotationId) {
      return NextResponse.json({ error: "请选择有效报价" }, { status: 400 });
    }
    if (!isValidIsoDate(deliveryDate)) {
      return NextResponse.json({ error: "交付日期格式无效" }, { status: 400 });
    }
    const order = await repository.orders.createFromQuotation({
      quotationId,
      deliveryDate,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof BusinessError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "请选择有效报价" }, { status: 400 });
    }
    return businessErrorResponse(error);
  }
}

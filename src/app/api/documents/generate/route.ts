import { NextRequest, NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";

const SUPPORTED_TYPES = new Set(["commercial_invoice", "packing_list", "proforma_invoice"]);

export async function POST(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const { orderId, type } = await req.json();
    if (!orderId) return NextResponse.json({ error: "请提供订单ID" }, { status: 400 });
    if (type && !SUPPORTED_TYPES.has(type)) {
      return NextResponse.json({ error: "当前数据不足以生成该单证" }, { status: 400 });
    }
    const types = type ? [type] : [...SUPPORTED_TYPES];
    const existing = await repository.documents.listByOrder(orderId);
    const results = await repository.documents.generateForOrder(orderId, types);

    return NextResponse.json({
      documents: results,
      count: results.length,
      createdCount: results.filter(document => {
        const previous = existing.find(item => item.id === document.id);
        return !previous || previous.status !== "generated";
      }).length,
    });
  } catch (error: unknown) {
    return businessErrorResponse(error);
  }
}

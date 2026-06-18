import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { orderId, apiKey, provider, model } = await req.json();
    if (!orderId) return NextResponse.json({ error: "请提供订单ID" }, { status: 400 });

    const order = store.orders.get(orderId);
    if (!order) return NextResponse.json({ error: "订单未找到" }, { status: 404 });

    const types = ["commercial_invoice", "packing_list", "proforma_invoice"];
    const results: any[] = [];

    for (const type of types) {
      const doc = {
        id: `d${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        orderId: order.id,
        orderNo: order.no,
        type,
        status: "generated" as const,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      store.documents.add(doc);
      results.push(doc);
    }

    return NextResponse.json({ documents: results, count: results.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store, type StoredDocument } from "@/lib/store";

const SUPPORTED_TYPES = new Set(["commercial_invoice", "packing_list", "proforma_invoice"]);

export async function POST(req: NextRequest) {
  try {
    const { orderId, type } = await req.json();
    if (!orderId) return NextResponse.json({ error: "请提供订单ID" }, { status: 400 });

    const order = store.orders.get(orderId);
    if (!order) return NextResponse.json({ error: "订单未找到" }, { status: 404 });

    if (type && !SUPPORTED_TYPES.has(type)) {
      return NextResponse.json({ error: "当前数据不足以生成该单证" }, { status: 400 });
    }
    const types = type ? [type] : [...SUPPORTED_TYPES];
    const results: StoredDocument[] = [];
    const existing = store.documents.byOrder(order.id);

    for (const type of types) {
      const existingDocument = existing.find(document => document.type === type);
      if (existingDocument) {
        if (existingDocument.status === "generated") {
          results.push(existingDocument);
        } else {
          const updated = store.documents.update(existingDocument.id, { status: "generated", createdAt: new Date().toISOString().slice(0, 10) });
          if (updated) results.push(updated);
        }
        continue;
      }
      const doc = {
        id: `d_${randomUUID()}`,
        orderId: order.id,
        orderNo: order.no,
        type,
        status: "generated" as const,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      store.documents.add(doc);
      results.push(doc);
    }

    return NextResponse.json({
      documents: results,
      count: results.length,
      createdCount: results.filter(document => {
        const previous = existing.find(item => item.id === document.id);
        return !previous || previous.status !== "generated";
      }).length,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "单证生成失败" }, { status: 500 });
  }
}

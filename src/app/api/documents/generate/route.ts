import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { boundedJson } from "@/lib/api-config/access";
import { CrmError } from "@/lib/crm-repository";
import type { StoredDocument, StoredOrder } from "@/lib/store";

const types = ["commercial_invoice", "packing_list", "proforma_invoice"] as const;
const input = z.object({ orderId: z.string().trim().min(1).max(240), type: z.enum(types).optional() }).strict();
async function handlePOST(req: NextRequest) {
  const parsed = input.safeParse(await boundedJson(req));
  if (!parsed.success) return NextResponse.json({ error: "请提供有效订单 ID 和支持的单证类型" }, { status: 400 });
  const { orderId, type } = parsed.data;
  const store = getStore();
  // One lock + transaction: concurrent/retried requests cannot generate a
  // partial batch, duplicate document types, or leak internal DB messages.
  const result = await store.write(async client => {
    const order = await store.read<StoredOrder>("orders", orderId, client);
    if (!order) throw new CrmError("订单未找到", 404);
    const existing = (await store.list<StoredDocument>("documents", client)).filter(doc => doc.orderId === order.id);
    const documents: StoredDocument[] = [];
    let createdCount = 0;
    for (const documentType of type ? [type] : types) {
      const previous = existing.find(doc => doc.type === documentType);
      if (previous?.status === "generated") { documents.push(previous); continue; }
      const doc: StoredDocument = {
        id: previous?.id || `d_${randomUUID()}`, orderId: order.id,
        orderNo: order.no, type: documentType, status: "generated",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      documents.push(await store.save(client, "documents", doc, !previous));
      createdCount++;
    }
    if (createdCount) await store.auditIn(client, "documents.generate", order.id, { createdCount });
    return { documents, count: documents.length, createdCount };
  });
  return NextResponse.json(result);
}
export const POST = withTenant(handlePOST);

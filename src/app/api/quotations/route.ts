import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store, type StoredLineItem, type StoredQuotation } from "@/lib/store";

const TRADE_TERMS = new Set(["FOB", "CIF", "EXW", "DDP"]);

function normalizeItems(value: unknown): StoredLineItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100)
    return null;
  const normalized: StoredLineItem[] = [];
  for (const raw of value) {
    const item = raw as Record<string, unknown>;
    const productName =
      typeof item.productName === "string" ? item.productName.trim() : "";
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (
      !productName ||
      productName.length > 300 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    )
      return null;
    const amount = Math.round(quantity * unitPrice * 100) / 100;
    normalized.push({
      productId:
        typeof item.productId === "string"
          ? item.productId.slice(0, 200)
          : undefined,
      productName,
      quantity,
      unit:
        typeof item.unit === "string" && item.unit.trim()
          ? item.unit.trim().slice(0, 40)
          : "pcs",
      unitPrice,
      amount,
    });
  }
  return normalized;
}

export async function GET() {
  const orderByQuotation = new Map(
    store.orders
      .list()
      .filter((order) => order.quotationId)
      .map((order) => [order.quotationId, order.id]),
  );
  return NextResponse.json(
    store.quotations.list().map((quotation) => ({
      ...quotation,
      orderId: orderByQuotation.get(quotation.id) || null,
    })),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const contactId =
    typeof body.contactId === "string" ? body.contactId.trim() : "";
  const items = normalizeItems(body.items);
  if (!contactId || !store.contacts.get(contactId)) {
    return NextResponse.json({ error: "请选择有效客户" }, { status: 400 });
  }
  if (!items) {
    return NextResponse.json(
      { error: "报价产品、数量或单价格式无效" },
      { status: 400 },
    );
  }
  const totalAmount =
    Math.round(items.reduce((sum, item) => sum + (item.amount || 0), 0) * 100) /
    100;
  const quotation: StoredQuotation = {
    id: `q_${randomUUID()}`,
    no: store.quotations.nextNo(),
    contactId,
    contactName: store.contacts.get(contactId)?.name || "",
    items,
    totalAmount,
    currency: ["USD", "EUR", "CNY"].includes(body.currency)
      ? body.currency
      : "USD",
    tradeTerm: TRADE_TERMS.has(body.tradeTerm) ? body.tradeTerm : "FOB",
    status: "draft",
    aiGenerated: body.aiGenerated === true,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.quotations.add(quotation);
  return NextResponse.json(quotation, { status: 201 });
}

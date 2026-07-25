import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import { isValidIsoDate } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(store.orders.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const quotationId =
    typeof body.quotationId === "string" ? body.quotationId.trim() : "";
  const quotation = store.quotations.get(quotationId);
  if (!quotation)
    return NextResponse.json({ error: "请选择有效报价" }, { status: 400 });
  if (quotation.status !== "accepted") {
    return NextResponse.json(
      { error: "只有已接受的报价才能创建订单" },
      { status: 409 },
    );
  }
  if (store.orders.list().some((order) => order.quotationId === quotation.id)) {
    return NextResponse.json(
      { error: "该报价已经创建过订单" },
      { status: 409 },
    );
  }
  const contact = store.contacts.get(quotation.contactId);
  if (!contact)
    return NextResponse.json({ error: "报价关联客户不存在" }, { status: 400 });
  const deliveryDate =
    typeof body.deliveryDate === "string" ? body.deliveryDate.trim() : "";
  if (!isValidIsoDate(deliveryDate)) {
    return NextResponse.json({ error: "交付日期格式无效" }, { status: 400 });
  }
  const order = {
    id: `o_${randomUUID()}`,
    no: store.orders.nextNo(),
    contactId: contact.id,
    contactName: contact.name,
    quotationId: quotation.id,
    items: quotation.items,
    totalAmount: quotation.totalAmount,
    currency: quotation.currency,
    status: "confirmed",
    deliveryDate,
    progressPercent: 0,
    tradeTerm: quotation.tradeTerm,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.orders.add(order);
  return NextResponse.json(order, { status: 201 });
}

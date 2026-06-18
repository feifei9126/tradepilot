import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { triggerHook } from "@/plugins/index";

export async function GET() {
  return NextResponse.json(store.orders.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const order = {
    id: `o${Date.now()}`,
    no: store.orders.nextNo(),
    contactId: body.contactId,
    contactName: body.contactName || "",
    quotationId: body.quotationId || null,
    items: body.items || [],
    totalAmount: body.totalAmount || 0,
    status: "confirmed",
    deliveryDate: body.deliveryDate || "",
    progressPercent: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.orders.add(order);
  await triggerHook("order.created", order);
  return NextResponse.json(order, { status: 201 });
}

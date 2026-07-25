import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const q = store.quotations.get(id);
  if (!q) return NextResponse.json({ error: "报价不存在" }, { status: 404 });
  return NextResponse.json(q);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
  if (store.orders.list().some((order) => order.quotationId === id)) {
    return NextResponse.json(
      { error: "已转为订单的报价不能再修改状态" },
      { status: 409 },
    );
  }
  const updated = store.quotations.update(id, { status: body.status });
  if (!updated)
    return NextResponse.json({ error: "报价不存在" }, { status: 404 });
  return NextResponse.json(updated);
}

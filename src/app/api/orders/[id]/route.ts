import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { triggerHook } from "@/plugins/index";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = store.orders.get(id);
  if (!order) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updated = store.orders.update(id, body);
  if (!updated) return NextResponse.json({ error: "未找到" }, { status: 404 });
  await triggerHook("order.statusChanged", updated);
  return NextResponse.json(updated);
}

import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const q = store.quotations.get(id);
  if (!q) return NextResponse.json({ error: "报价不存在" }, { status: 404 });
  return NextResponse.json(q);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json();
  const updated = store.quotations.update(id, body);
  if (!updated) return NextResponse.json({ error: "报价不存在" }, { status: 404 });
  return NextResponse.json(updated);
}

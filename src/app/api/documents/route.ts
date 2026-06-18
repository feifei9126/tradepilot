import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (orderId) return NextResponse.json(store.documents.byOrder(orderId));
  return NextResponse.json(store.documents.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const doc = {
    id: `d${Date.now()}`,
    orderId: body.orderId || "",
    orderNo: body.orderNo || "",
    type: body.type || "commercial_invoice",
    status: "generated" as const,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.documents.add(doc);
  return NextResponse.json(doc, { status: 201 });
}
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID必填" }, { status: 400 });
    const ok = (store.documents as any).remove(id);
    if (ok) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

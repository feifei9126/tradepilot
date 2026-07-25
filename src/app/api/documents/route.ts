import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (orderId) return NextResponse.json(store.documents.byOrder(orderId));
  return NextResponse.json(store.documents.list());
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID必填" }, { status: 400 });
    const ok = store.documents.remove(id);
    if (ok) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "文档删除失败" }, { status: 500 });
  }
}

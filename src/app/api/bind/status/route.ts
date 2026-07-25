import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
export async function GET() { return NextResponse.json({ bindings: store.bindings.getAll() }); }

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!phone) return NextResponse.json({ error: "手机号必填" }, { status: 400 });
  if (!store.bindings.remove(phone)) return NextResponse.json({ error: "未找到绑定账号" }, { status: 404 });
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { store, type StoredContact } from "@/lib/store";
import { isValidEmail } from "@/lib/validation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contact = store.contacts.get(id);
  if (!contact) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const patch: Partial<StoredContact> = {};
  if (typeof body.name === "string" && body.name.trim())
    patch.name = body.name.trim().slice(0, 200);
  if (typeof body.country === "string")
    patch.country = body.country.trim().slice(0, 100);
  if (typeof body.source === "string")
    patch.source = body.source.trim().slice(0, 100);
  if (typeof body.notes === "string")
    patch.notes = body.notes.trim().slice(0, 10_000);
  if (typeof body.email === "string") {
    const email = body.email.trim();
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "客户邮箱格式无效" }, { status: 400 });
    }
    patch.email = email;
  }
  if (typeof body.phone === "string")
    patch.phone = body.phone.trim().slice(0, 80);
  if (["A", "B", "C"].includes(body.grade)) patch.grade = body.grade;
  if (
    ["new", "following", "negotiating", "converted", "lost"].includes(
      body.stage,
    )
  )
    patch.stage = body.stage;
  if (Array.isArray(body.tags)) {
    patch.tags = body.tags
      .filter((tag: unknown): tag is string => typeof tag === "string")
      .map((tag: string) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json(
      { error: "没有可更新的客户字段" },
      { status: 400 },
    );
  const updated = store.contacts.update(id, patch);
  if (!updated) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const hasBusinessRecords =
    store.quotations.list().some((record) => record.contactId === id) ||
    store.orders.list().some((record) => record.contactId === id);
  if (hasBusinessRecords) {
    return NextResponse.json(
      { error: "客户已关联报价或订单，不能删除" },
      { status: 409 },
    );
  }
  const deleted = store.contacts.delete(id);
  if (!deleted) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ success: true });
}

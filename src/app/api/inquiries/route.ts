import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json(store.inquiries.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const customer =
    typeof body.customer === "string" ? body.customer.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!customer || !subject || !content) {
    return NextResponse.json(
      { error: "客户、主题和询盘内容必填" },
      { status: 400 },
    );
  }
  if (
    customer.length > 200 ||
    subject.length > 300 ||
    content.length > 20_000
  ) {
    return NextResponse.json(
      { error: "客户、主题或询盘内容超出长度限制" },
      { status: 413 },
    );
  }
  const contactId =
    typeof body.contactId === "string" ? body.contactId.trim() : "";
  if (contactId && !store.contacts.get(contactId)) {
    return NextResponse.json({ error: "关联客户不存在" }, { status: 400 });
  }
  const source =
    typeof body.source === "string" ? body.source.trim().slice(0, 100) : "";
  const inquiry = {
    id: `i_${randomUUID()}`,
    customer,
    contactId,
    subject,
    content,
    source: source || "手动录入",
    status: "pending" as const,
    aiReply: "",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.inquiries.add(inquiry);
  return NextResponse.json(inquiry, { status: 201 });
}

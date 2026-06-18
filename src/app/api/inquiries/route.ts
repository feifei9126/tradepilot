import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { triggerHook } from "@/plugins/index";

export async function GET() {
  return NextResponse.json(store.inquiries.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const inquiry = {
    id: `i${Date.now()}`,
    customer: body.customer || "",
    contactId: body.contactId || "",
    subject: body.subject || "",
    content: body.content || "",
    source: body.source || "手动录入",
    status: "pending" as const,
    aiReply: "",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.inquiries.add(inquiry);
  await triggerHook("inquiry.received", inquiry);
  return NextResponse.json(inquiry, { status: 201 });
}

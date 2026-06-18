import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(req: NextRequest) {
  const contact = req.nextUrl.searchParams.get("contact");
  const channel = req.nextUrl.searchParams.get("channel");
  let msgs = store.messages.list();
  if (contact) msgs = store.messages.byContact(contact);
  if (channel) msgs = msgs.filter(m => m.channel === channel);
  return NextResponse.json(msgs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const msg = {
    id: "m" + Date.now(),
    contactId: body.contactId || "",
    contactName: body.contactName || "未知",
    channel: body.channel || "other",
    content: body.content || "",
    direction: body.direction || "in",
    read: false,
    aiReply: "",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.messages.add(msg);
  return NextResponse.json(msg, { status: 201 });
}

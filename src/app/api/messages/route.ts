import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store, type StoredMessage } from "@/lib/store";

export async function GET(req: NextRequest) {
  const contact = req.nextUrl.searchParams.get("contact");
  const channel = req.nextUrl.searchParams.get("channel");
  let msgs = store.messages.list();
  if (contact) msgs = store.messages.byContact(contact);
  if (channel) msgs = msgs.filter((m) => m.channel === channel);
  return NextResponse.json(msgs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const contactName =
    typeof body.contactName === "string" ? body.contactName.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const channel: StoredMessage["channel"] = [
    "whatsapp",
    "wechat",
    "email",
    "other",
  ].includes(body.channel)
    ? body.channel
    : "other";
  const direction: StoredMessage["direction"] | null =
    body.direction === "out" ? "out" : body.direction === "in" ? "in" : null;
  if (!contactName || !content || !direction) {
    return NextResponse.json(
      { error: "联系人、消息内容和方向必填" },
      { status: 400 },
    );
  }
  if (contactName.length > 200 || content.length > 20_000) {
    return NextResponse.json(
      { error: "联系人或消息内容超出限制" },
      { status: 413 },
    );
  }
  const contactId =
    typeof body.contactId === "string" ? body.contactId.trim() : "";
  if (contactId && !store.contacts.get(contactId)) {
    return NextResponse.json({ error: "关联客户不存在" }, { status: 400 });
  }
  const msg = {
    id: `m_${randomUUID()}`,
    contactId,
    contactName,
    channel,
    content,
    direction,
    read: direction === "out",
    aiReply: "",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.messages.add(msg);
  return NextResponse.json(msg, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const ids = Array.isArray(body.ids)
    ? body.ids
        .filter((id: unknown): id is string => typeof id === "string")
        .slice(0, 500)
    : [];
  const contactName =
    typeof body.contactName === "string" ? body.contactName.trim() : "";
  const targets =
    ids.length > 0
      ? store.messages.list().filter((message) => ids.includes(message.id))
      : contactName
        ? store.messages.byContact(contactName)
        : [];
  if (targets.length === 0)
    return NextResponse.json({ error: "没有可更新的消息" }, { status: 400 });
  targets.forEach((message) => store.messages.markRead(message.id));
  return NextResponse.json({ updated: targets.length });
}

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import { hasValidWebhookSecret } from "@/lib/webhook-auth";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.TRADEPILOT_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Webhook 尚未配置" }, { status: 503 });
    }
    if (
      !hasValidWebhookSecret(
        req.headers.get("authorization"),
        process.env.TRADEPILOT_WEBHOOK_SECRET,
      )
    ) {
      return NextResponse.json({ error: "Webhook 鉴权失败" }, { status: 401 });
    }

    const body = await req.json();
    const contactName =
      typeof body.contactName === "string" ? body.contactName.trim() : "";
    const contactId =
      typeof body.contactId === "string" ? body.contactId.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const channel = ["whatsapp", "wechat", "email", "other"].includes(
      body.channel,
    )
      ? body.channel
      : "other";
    if (!contactName || !content)
      return NextResponse.json(
        { error: "contactName and content required" },
        { status: 400 },
      );
    if (
      contactName.length > 200 ||
      contactId.length > 200 ||
      content.length > 20_000
    ) {
      return NextResponse.json({ error: "消息内容超出限制" }, { status: 413 });
    }
    if (contactId && !store.contacts.get(contactId)) {
      return NextResponse.json({ error: "关联客户不存在" }, { status: 400 });
    }

    const msg = {
      id: `wh_${randomUUID()}`,
      contactId: contactId || "",
      contactName,
      content,
      channel: channel || "other",
      direction: "in" as const,
      read: false,
      aiReply: "",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    store.messages.add(msg);
    return NextResponse.json({
      received: true,
      message: msg,
      autoReplied: false,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "消息接收失败" },
      { status: 500 },
    );
  }
}

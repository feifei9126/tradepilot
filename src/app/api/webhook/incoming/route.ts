import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactName, contactId, content, channel, apiKey, provider, model } = body;
    if (!contactName || !content) return NextResponse.json({ error: "contactName and content required" }, { status: 400 });

    const msg = { id: "wh" + Date.now(), contactId: contactId || "", contactName, content, channel: channel || "other", direction: "in" as const, read: false, aiReply: "", createdAt: new Date().toISOString().slice(0, 10) };
    store.messages.add(msg);

    const cfg = store.autoReply.get(contactId || contactName);
    if (cfg.enabled && apiKey) {
      const origin = process.env.NEXTAUTH_URL || "http://localhost:3456";
      const autoRes = await fetch(origin + "/api/messages/auto-reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName, contactId, content, channel, apiKey, provider, model }),
      });
      const autoData = await autoRes.json();
      return NextResponse.json({ received: true, message: msg, autoReplied: autoData.autoReplied, reply: autoData.reply || null });
    }
    return NextResponse.json({ received: true, message: msg, autoReplied: false, reason: "auto_reply_disabled" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

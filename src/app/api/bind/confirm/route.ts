import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { consumeBindToken } from "@/lib/bind-tokens";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = typeof body.token === "string" ? body.token : "";
  const deviceId = typeof body.deviceId === "string" && body.deviceId.trim() ? body.deviceId.trim().slice(0, 120) : "mobile";
  if (!token) return NextResponse.json({ error: "缺少 token" }, { status: 400 });

  const result = consumeBindToken(token);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const { pending } = result;

  store.bindings.set(pending.phone, { channel: pending.channel, phone: pending.phone, deviceId, boundAt: new Date().toISOString() });
  return NextResponse.json({ success: true, channel: pending.channel, phone: pending.phone });
}

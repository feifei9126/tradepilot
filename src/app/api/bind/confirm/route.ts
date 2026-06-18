import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { token, channel, phone, deviceId } = await req.json();
  if (!token) return NextResponse.json({ error: "缺少 token" }, { status: 400 });

  const tokens = (global as any).__bindTokens || {};
  const bindData = tokens[token];
  if (!bindData) return NextResponse.json({ error: "无效或已过期的二维码" }, { status: 400 });
  if (Date.now() > bindData.expiresAt) { delete tokens[token]; return NextResponse.json({ error: "二维码已过期" }, { status: 400 }); }

  store.bindings.set(phone || bindData.phone, { channel: channel || bindData.channel, phone: phone || bindData.phone, deviceId: deviceId || "mobile", boundAt: new Date().toISOString() });
  delete tokens[token];
  return NextResponse.json({ success: true, channel: channel || bindData.channel, phone: phone || bindData.phone });
}

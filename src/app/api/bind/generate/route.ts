import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { channel, phone } = await req.json();
  if (!channel || !phone) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

  const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const qrData = JSON.stringify({ token, channel, phone, server: req.headers.get("host") || "localhost:3456" });
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodeURIComponent(qrData);

  (global as any).__bindTokens = (global as any).__bindTokens || {};
  (global as any).__bindTokens[token] = { token, channel, phone, expiresAt: Date.now() + 300000 };

  return NextResponse.json({ token, qrData, qrUrl, channel, phone, expiresAt: Date.now() + 300000 });
}

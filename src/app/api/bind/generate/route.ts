import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

import { createBindToken } from "@/lib/bind-tokens";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const channel = body.channel === "whatsapp" || body.channel === "wechat" ? body.channel : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!channel || !phone) return NextResponse.json({ error: "渠道和手机号必填" }, { status: 400 });
  if (phone.length > 40) return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });

  const pending = createBindToken(channel, phone);
  const configuredOrigin = process.env.AUTH_URL || req.nextUrl.origin;
  const qrData = JSON.stringify({
    version: 1,
    token: pending.token,
    confirmUrl: new URL("/api/bind/confirm", configuredOrigin).toString(),
  });
  const qrUrl = await QRCode.toDataURL(qrData, { width: 250, margin: 1, errorCorrectionLevel: "M" });

  return NextResponse.json({ token: pending.token, qrData, qrUrl, channel, phone, expiresAt: pending.expiresAt });
}

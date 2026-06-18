import { NextResponse } from "next/server";
const accounts = [{ id: "a1", name: "\u516c\u53f8\u90ae\u7bb1", email: "sales@tradepilot.com", imapHost: "imap.example.com", imapPort: 993, smtpHost: "smtp.example.com", smtpPort: 465, syncEnabled: true }];
export async function GET() { return NextResponse.json({ accounts }); }
export async function POST(req: Request) {
  const body = await req.json();
  const acct = { id: "a_" + Date.now(), ...body, createdAt: new Date().toISOString() };
  accounts.push(acct as any);
  return NextResponse.json({ ok: true, account: acct });
}

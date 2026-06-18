import { NextResponse } from "next/server";

// Mock email data for MVP
const mockEmails = [
  { id: "e1", accountId: "a1", messageId: "msg1", from: "john@bestbuy.com", to: "sales@tradepilot.com", subject: "Q3 Order Inquiry - Electronic Components", body: "Dear TradePilot team,\n\nWe are interested in ordering 5,000 units of your electronic components for Q3. Could you please provide a quotation for Model TP-1001?\n\nBest regards,\nJohn Smith\nProcurement Manager\nBestBuy Co.", date: "2026-06-15T09:23:00Z", folder: "inbox", isRead: false, isStarred: true, labels: ["inquiry"], contactId: "c1", createdAt: "2026-06-15T09:23:00Z" },
  { id: "e2", accountId: "a1", messageId: "msg2", from: "hans@eurotech.de", to: "sales@tradepilot.com", subject: "Re: Product Catalog Request", body: "Thank you for sending the catalog. We are particularly interested in your industrial-grade sensors. Could you arrange a sample shipment to our Hamburg office?\n\nBest,\nHans Mueller\nCEO - EuroTech GmbH", date: "2026-06-14T14:15:00Z", folder: "inbox", isRead: false, isStarred: false, labels: ["sample"], contactId: "c2", createdAt: "2026-06-14T14:15:00Z" },
  { id: "e3", accountId: "a1", messageId: "msg3", from: "sales@tradepilot.com", to: "john@bestbuy.com", subject: "Quotation: TP-1001 5,000 units", body: "Dear John,\n\nThank you for your inquiry. Please find attached our quotation for 5,000 units of TP-1001 at USD 12.50/unit FOB Shanghai.\n\nBest regards,\nTradePilot Sales Team", date: "2026-06-15T10:30:00Z", folder: "sent", isRead: true, isStarred: false, labels: ["quotation"], contactId: "c1", createdAt: "2026-06-15T10:30:00Z" },
  { id: "e4", accountId: "a1", messageId: "msg4", from: "info@newclient.de", to: "sales@tradepilot.com", subject: "New Partnership Inquiry", body: "Hello,\n\nWe found your company through Alibaba and are interested in establishing a business relationship.\n\nRegards,\nSarah Weber", date: "2026-06-13T08:00:00Z", folder: "inbox", isRead: true, isStarred: false, labels: [], createdAt: "2026-06-13T08:00:00Z" },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "inbox";
  const q = url.searchParams.get("q") || "";
  let filtered = mockEmails.filter(e => e.folder === folder);
  if (q) filtered = filtered.filter(e => e.subject.toLowerCase().includes(q.toLowerCase()) || e.from.toLowerCase().includes(q.toLowerCase()));
  return NextResponse.json({ emails: filtered });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, body: emailBody, cc } = body;
    if (!to || !subject) return NextResponse.json({ error: "收件人和主题必填" }, { status: 400 });
    const newEmail = {
      id: "e_" + Date.now(), accountId: "a1", messageId: "msg_" + Date.now(),
      from: "sales@tradepilot.com", to, subject, body: emailBody || "",
      date: new Date().toISOString(), folder: "sent", isRead: true, isStarred: false,
      labels: [], createdAt: new Date().toISOString(),
    };
    return NextResponse.json({ ok: true, email: newEmail });
  } catch { return NextResponse.json({ error: "发送失败" }, { status: 500 }); }
}

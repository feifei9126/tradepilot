import { NextResponse } from "next/server";
import { store } from "@/lib/store";

interface LocalEmailRecord {
  id: string;
  accountId: string;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  folder: "inbox" | "sent" | "draft" | "trash";
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  contactId?: string;
  createdAt: string;
}

// Sample records keep the email workspace testable without claiming IMAP is connected.
const emailRecords: LocalEmailRecord[] = [
  {
    id: "e1",
    accountId: "sample",
    messageId: "msg1",
    from: "john@bestbuy.com",
    to: "sales@example.com",
    subject: "Q3 Order Inquiry - Electronic Components",
    body: "Dear team,\n\nWe are interested in ordering 5,000 units for Q3. Could you provide a quotation?\n\nBest regards,\nJohn Smith",
    date: "2026-06-15T09:23:00Z",
    folder: "inbox",
    isRead: false,
    isStarred: true,
    labels: ["示例", "询盘"],
    contactId: "c1",
    createdAt: "2026-06-15T09:23:00Z",
  },
  {
    id: "e2",
    accountId: "sample",
    messageId: "msg2",
    from: "hans@eurotech.de",
    to: "sales@example.com",
    subject: "Re: Product Catalog Request",
    body: "Thank you for sending the catalog. Could you arrange a sample shipment to our Hamburg office?",
    date: "2026-06-14T14:15:00Z",
    folder: "inbox",
    isRead: false,
    isStarred: false,
    labels: ["示例", "样品"],
    contactId: "c2",
    createdAt: "2026-06-14T14:15:00Z",
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "inbox";
  const query = (url.searchParams.get("q") || "").toLowerCase();
  let filtered = emailRecords.filter((email) => email.folder === folder);
  if (query) {
    filtered = filtered.filter(
      (email) =>
        email.subject.toLowerCase().includes(query) ||
        email.from.toLowerCase().includes(query) ||
        email.body.toLowerCase().includes(query),
    );
  }
  return NextResponse.json({ emails: filtered, mode: "local-draft" });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const to = typeof payload.to === "string" ? payload.to.trim() : "";
    const subject =
      typeof payload.subject === "string" ? payload.subject.trim() : "";
    if (!to || !subject) {
      return NextResponse.json({ error: "收件人和主题必填" }, { status: 400 });
    }
    const body = typeof payload.body === "string" ? payload.body : "";
    if (to.length > 1_000 || subject.length > 500 || body.length > 100_000) {
      return NextResponse.json(
        { error: "草稿内容超出长度限制" },
        { status: 413 },
      );
    }
    if (payload.action !== "save-draft") {
      return NextResponse.json(
        { error: "SMTP 尚未连接，当前只支持保存本地草稿" },
        { status: 503 },
      );
    }

    const now = new Date().toISOString();
    const email: LocalEmailRecord = {
      id: crypto.randomUUID(),
      accountId: "local",
      messageId: crypto.randomUUID(),
      from: "local-draft",
      to,
      subject,
      body,
      date: now,
      folder: "draft",
      isRead: true,
      isStarred: false,
      labels: ["本地草稿"],
      createdAt: now,
    };
    emailRecords.unshift(email);
    return NextResponse.json({ ok: true, email, mode: "local-draft" });
  } catch {
    return NextResponse.json({ error: "草稿保存失败" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const payload = (await req.json()) as {
      id?: string;
      isRead?: boolean;
      contactId?: string;
    };
    const email = emailRecords.find((item) => item.id === payload.id);
    if (!email)
      return NextResponse.json({ error: "邮件不存在" }, { status: 404 });
    let changed = false;
    if (typeof payload.isRead === "boolean") {
      email.isRead = payload.isRead;
      changed = true;
    }
    if (typeof payload.contactId === "string") {
      const contactId = payload.contactId.trim();
      if (contactId && !store.contacts.get(contactId)) {
        return NextResponse.json({ error: "关联客户不存在" }, { status: 400 });
      }
      email.contactId = contactId || undefined;
      changed = true;
    }
    if (!changed) {
      return NextResponse.json(
        { error: "没有可更新的邮件字段" },
        { status: 400 },
      );
    }
    return NextResponse.json({ email });
  } catch {
    return NextResponse.json({ error: "更新邮件失败" }, { status: 400 });
  }
}

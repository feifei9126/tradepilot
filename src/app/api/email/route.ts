import { NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { DEMO_COMPANY_ID, resolveStorageMode } from "@/lib/business/runtime";
import {
  authorizeEmailContext,
  getPostgresEmailRepository,
} from "@/lib/email/runtime";
import type { EmailMessage } from "@/lib/email/types";
import { parseEmailMessageInput } from "@/lib/email/validation";

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

const sampleRecords: LocalEmailRecord[] = [
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
    labels: ["demo", "inquiry"],
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
    labels: ["demo", "sample"],
    contactId: "c2",
    createdAt: "2026-06-14T14:15:00Z",
  },
];

const localRecords = new Map<string, LocalEmailRecord[]>();

function recordsForCompany(companyId: string) {
  let records = localRecords.get(companyId);
  if (!records) {
    records = companyId === DEMO_COMPANY_ID ? structuredClone(sampleRecords) : [];
    localRecords.set(companyId, records);
  }
  return records;
}

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    throw new BusinessError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
  }
}

function firstAddress(addresses: { email: string }[]) {
  return addresses[0]?.email || "";
}

function messageView(message: EmailMessage): LocalEmailRecord {
  return {
    id: message.id,
    accountId: message.accountId,
    messageId: message.providerMessageId || message.externalId || message.id,
    from: firstAddress(message.from),
    to: firstAddress(message.to),
    subject: message.subject,
    body: message.textBody || "",
    date: message.receivedAt || message.sentAt || message.createdAt,
    folder: message.folder,
    isRead: message.isRead,
    isStarred: message.isStarred,
    labels: [],
    createdAt: message.createdAt,
  };
}

function filteredRecords(
  records: LocalEmailRecord[],
  folder: string,
  query: string,
) {
  return records.filter((email) =>
    email.folder === folder &&
    (!query ||
      email.subject.toLowerCase().includes(query) ||
      email.from.toLowerCase().includes(query) ||
      email.body.toLowerCase().includes(query)),
  );
}

export async function GET(request: Request) {
  try {
    const context = await authorizeEmailContext(
      requireBusinessContext(request),
      "email:use",
    );
    const url = new URL(request.url);
    const folder = url.searchParams.get("folder") || "inbox";
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    if (resolveStorageMode() === "memory") {
      return NextResponse.json({
        emails: filteredRecords(recordsForCompany(context.companyId), folder, query),
        mode: "local-draft",
      });
    }

    const accountId = url.searchParams.get("accountId")?.trim() || undefined;
    const messages = await getPostgresEmailRepository().listMessages(
      context.companyId,
      { accountId, folder, limit: 200 },
    );
    return NextResponse.json({
      emails: filteredRecords(messages.map(messageView), folder, query),
      mode: "configured",
    });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await authorizeEmailContext(
      requireBusinessContext(request),
      "email:use",
    );
    const parsed = parseEmailMessageInput(await readJson(request));
    if (resolveStorageMode() !== "memory" || parsed.action === "send") {
      throw new BusinessError(
        "PROVIDER_NOT_CONFIGURED",
        "Email delivery is not configured",
        503,
      );
    }

    const now = new Date().toISOString();
    const email: LocalEmailRecord = {
      id: crypto.randomUUID(),
      accountId: "local",
      messageId: crypto.randomUUID(),
      from: "local-draft",
      to: parsed.to.map((address) => address.email).join(", "),
      subject: parsed.subject,
      body: parsed.body,
      date: now,
      folder: "draft",
      isRead: true,
      isStarred: false,
      labels: ["local-draft"],
      createdAt: now,
    };
    recordsForCompany(context.companyId).unshift(email);
    return NextResponse.json({ ok: true, email, mode: "local-draft" });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await authorizeEmailContext(
      requireBusinessContext(request),
      "email:use",
    );
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BusinessError("VALIDATION_ERROR", "Email update is invalid", 400);
    }
    const input = body as Record<string, unknown>;
    const id = typeof input.id === "string" ? input.id.trim() : "";
    const isRead = typeof input.isRead === "boolean" ? input.isRead : undefined;
    const isStarred = typeof input.isStarred === "boolean" ? input.isStarred : undefined;
    if (!id || id.length > 100 || (isRead === undefined && isStarred === undefined)) {
      throw new BusinessError("VALIDATION_ERROR", "Email update is invalid", 400);
    }

    if (resolveStorageMode() === "memory") {
      const email = recordsForCompany(context.companyId).find((item) => item.id === id);
      if (!email) throw new BusinessError("NOT_FOUND", "Email message not found", 404);
      if (isRead !== undefined) email.isRead = isRead;
      if (isStarred !== undefined) email.isStarred = isStarred;
      return NextResponse.json({ email, mode: "local-draft" });
    }

    const message = await getPostgresEmailRepository().updateMessage(
      context.companyId,
      id,
      { isRead, isStarred },
    );
    if (!message) throw new BusinessError("NOT_FOUND", "Email message not found", 404);
    return NextResponse.json({ email: messageView(message), mode: "configured" });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

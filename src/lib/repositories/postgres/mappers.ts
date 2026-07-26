import { BusinessError } from "@/lib/business/errors";
import type {
  StoredContact,
  StoredInquiry,
  StoredLineItem,
  StoredOrder,
  StoredProduct,
  StoredProductMedia,
  StoredQuotation,
} from "@/lib/business/types";
import type {
  communications,
  contactPersons,
  contacts,
  inquiries,
  orders,
  products,
  quotations,
} from "@/db/schema";

type ContactRow = typeof contacts.$inferSelect;
type ContactPersonRow = typeof contactPersons.$inferSelect;
type CommunicationRow = typeof communications.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type InquiryRow = typeof inquiries.$inferSelect;
type QuotationRow = typeof quotations.$inferSelect;
type OrderRow = typeof orders.$inferSelect;

export function decimalNumber(value: string | number | null | undefined) {
  if (value == null) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BusinessError(
      "DATABASE_SCHEMA_OUTDATED",
      "数据库金额字段无效",
      503,
    );
  }
  return parsed;
}

export function isoDate(value: Date | string | null | undefined) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BusinessError(
      "DATABASE_SCHEMA_OUTDATED",
      "数据库日期字段无效",
      503,
    );
  }
  return date.toISOString().slice(0, 10);
}

export function isoTimestamp(value: Date | string | null | undefined) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BusinessError(
      "DATABASE_SCHEMA_OUTDATED",
      "数据库时间字段无效",
      503,
    );
  }
  return date.toISOString();
}

function mediaItems(value: unknown): StoredProductMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      (record.type !== "image" && record.type !== "video") ||
      typeof record.url !== "string" ||
      typeof record.createdAt !== "string"
    ) {
      return [];
    }
    return [
      {
        id: record.id,
        type: record.type,
        url: record.url,
        sourceUrl:
          typeof record.sourceUrl === "string" ? record.sourceUrl : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        mimeType:
          typeof record.mimeType === "string" ? record.mimeType : undefined,
        createdAt: record.createdAt,
      },
    ];
  });
}

export function lineItems(value: unknown): StoredLineItem[] {
  if (!Array.isArray(value)) {
    throw new BusinessError(
      "DATABASE_SCHEMA_OUTDATED",
      "数据库业务明细字段无效",
      503,
    );
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new BusinessError(
        "DATABASE_SCHEMA_OUTDATED",
        "数据库业务明细字段无效",
        503,
      );
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.productName !== "string" ||
      !Number.isFinite(Number(record.quantity))
    ) {
      throw new BusinessError(
        "DATABASE_SCHEMA_OUTDATED",
        "数据库业务明细字段无效",
        503,
      );
    }
    return {
      productId:
        typeof record.productId === "string" ? record.productId : undefined,
      productName: record.productName,
      quantity: Number(record.quantity),
      unit: typeof record.unit === "string" ? record.unit : undefined,
      unitPrice:
        record.unitPrice == null ? undefined : decimalNumber(record.unitPrice as string | number),
      amount:
        record.amount == null ? undefined : decimalNumber(record.amount as string | number),
    };
  });
}

function orderCommunications(value: unknown): StoredOrder["comms"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.from !== "string" ||
      typeof record.date !== "string" ||
      typeof record.channel !== "string" ||
      typeof record.text !== "string"
    ) {
      return [];
    }
    return [
      {
        from: record.from,
        date: record.date,
        channel: record.channel,
        text: record.text,
      },
    ];
  });
}

export function mapContact(
  row: ContactRow,
  personRows: ContactPersonRow[] = [],
  activityRows: CommunicationRow[] = [],
): StoredContact {
  const persons = personRows.map((person) => ({
    name: person.name,
    position: person.position || undefined,
    phone: person.phone || undefined,
    email: person.email || undefined,
    isPrimary: Boolean(person.isPrimary),
  }));
  const primary = persons.find((person) => person.isPrimary) || persons[0];

  return {
    id: row.id,
    name: row.name,
    country: row.country || undefined,
    source: row.source || undefined,
    tags: row.tags || [],
    notes: row.notes || undefined,
    email: primary?.email,
    phone: primary?.phone,
    grade:
      row.grade === "A" || row.grade === "B" || row.grade === "C"
        ? row.grade
        : undefined,
    stage: row.stage || undefined,
    persons,
    activities: activityRows.map((activity) => ({
      date: isoDate(activity.occurredAt) || "",
      type: activity.channel,
      note: activity.rawContent || activity.subject || "",
    })),
    lastContactedAt: isoTimestamp(row.lastContactedAt),
    nextFollowUpAt: isoTimestamp(row.nextFollowUpAt),
    createdAt: isoDate(row.createdAt) || "",
  };
}

export function mapProduct(row: ProductRow): StoredProduct {
  return {
    id: row.id,
    name: row.name,
    modelNo: row.modelNo || undefined,
    hsCode: row.hsCode || undefined,
    costPrice: decimalNumber(row.costPrice),
    unit: row.unit || "pcs",
    moq: row.moq || undefined,
    category: row.category || undefined,
    description: row.description || undefined,
    stockQuantity: row.stockQuantity || 0,
    lowStockThreshold: row.lowStockThreshold || 0,
    warehouse: row.warehouse || undefined,
    source: row.source || undefined,
    media: mediaItems(row.media),
  };
}

export function mapInquiry(row: InquiryRow): StoredInquiry {
  return {
    id: row.id,
    customer: row.customerName,
    contactId: row.contactId || undefined,
    subject: row.subject || "",
    content: row.rawText || "",
    source: row.source || "",
    status:
      row.status === "quoted" ||
      row.status === "converted" ||
      row.status === "lost"
        ? row.status
        : "pending",
    aiReply: row.aiReply || undefined,
    createdAt: isoDate(row.createdAt) || "",
  };
}

export function mapQuotation(
  row: QuotationRow,
  contactName: string,
  orderId: string | null = null,
): StoredQuotation {
  return {
    id: row.id,
    no: row.quotationNo,
    contactId: row.contactId,
    contactName,
    items: lineItems(row.itemsJson),
    totalAmount: decimalNumber(row.totalAmount),
    currency: row.currency || "USD",
    tradeTerm: row.tradeTerm || "FOB",
    status: row.status || "draft",
    aiGenerated: Boolean(row.aiGenerated),
    createdAt: isoDate(row.createdAt) || "",
    orderId,
  };
}

export function mapOrder(row: OrderRow, contactName: string): StoredOrder {
  return {
    id: row.id,
    no: row.orderNo,
    contactId: row.contactId,
    contactName,
    quotationId: row.quotationId || undefined,
    items: lineItems(row.itemsJson),
    totalAmount: decimalNumber(row.totalAmount),
    currency: row.currency || "USD",
    status: row.status || "confirmed",
    deliveryDate: isoDate(row.deliveryDate),
    progressPercent: row.progressPercent || 0,
    tradeTerm: row.tradeTerm || undefined,
    comms: orderCommunications(row.commsJson),
    createdAt: isoDate(row.createdAt) || "",
  };
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error) return String(error.code);
  if ("cause" in error) return errorCode(error.cause);
  return undefined;
}

export function throwRepositoryError(error: unknown): never {
  if (error instanceof BusinessError) throw error;
  const code = errorCode(error);
  if (code === "23505" || code === "23503") {
    throw new BusinessError("CONFLICT", "数据关联或唯一性冲突", 409, {
      cause: error,
    });
  }
  throw new BusinessError("DATABASE_UNAVAILABLE", "数据库暂时不可用", 503, {
    cause: error,
  });
}

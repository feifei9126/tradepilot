import { NextRequest, NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";
import type { StoredLineItem } from "@/lib/store";

const TRADE_TERMS = new Set(["FOB", "CIF", "EXW", "DDP"]);

function normalizeItems(value: unknown): StoredLineItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100)
    return null;
  const normalized: StoredLineItem[] = [];
  for (const raw of value) {
    const item = raw as Record<string, unknown>;
    const productName =
      typeof item.productName === "string" ? item.productName.trim() : "";
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (
      !productName ||
      productName.length > 300 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    )
      return null;
    const amount = Math.round(quantity * unitPrice * 100) / 100;
    normalized.push({
      productId:
        typeof item.productId === "string"
          ? item.productId.slice(0, 200)
          : undefined,
      productName,
      quantity,
      unit:
        typeof item.unit === "string" && item.unit.trim()
          ? item.unit.trim().slice(0, 40)
          : "pcs",
      unitPrice,
      amount,
    });
  }
  return normalized;
}

export async function GET(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    return NextResponse.json(await repository.quotations.list());
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const body = await req.json();
    const contactId =
      typeof body.contactId === "string" ? body.contactId.trim() : "";
    const items = normalizeItems(body.items);
    if (!contactId || !(await repository.contacts.get(contactId))) {
      return NextResponse.json({ error: "请选择有效客户" }, { status: 400 });
    }
    if (!items) {
      return NextResponse.json(
        { error: "报价产品、数量或单价格式无效" },
        { status: 400 },
      );
    }
    const quotation = await repository.quotations.create({
      contactId,
      items,
      currency: ["USD", "EUR", "CNY"].includes(body.currency)
        ? body.currency
        : "USD",
      tradeTerm: TRADE_TERMS.has(body.tradeTerm) ? body.tradeTerm : "FOB",
      aiGenerated: body.aiGenerated === true,
    });
    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

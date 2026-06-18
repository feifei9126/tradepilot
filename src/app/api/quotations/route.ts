import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json(store.quotations.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const quotation = {
    id: `q${Date.now()}`,
    no: body.no || store.quotations.nextNo(),
    contactId: body.contactId,
    contactName: body.contactName || "",
    items: body.items || [],
    totalAmount: body.totalAmount || 0,
    currency: body.currency || "USD",
    tradeTerm: body.tradeTerm || "FOB",
    status: "draft",
    aiGenerated: body.aiGenerated || false,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.quotations.add(quotation);
  return NextResponse.json(quotation, { status: 201 });
}

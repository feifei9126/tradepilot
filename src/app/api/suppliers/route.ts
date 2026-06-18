import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json(store.suppliers.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supplier = {
    id: `s${Date.now()}`,
    name: body.name || "",
    contactName: body.contactName || "",
    phone: body.phone || "",
    email: body.email || "",
    country: body.country || "中国",
    products: body.products || [],
    rating: body.rating || 3,
    tags: body.tags || [],
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.suppliers.add(supplier);
  return NextResponse.json(supplier, { status: 201 });
}

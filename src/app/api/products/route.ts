import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json(store.products.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const product = { id: `p${Date.now()}`, ...body };
  store.products.add(product);
  return NextResponse.json(product, { status: 201 });
}

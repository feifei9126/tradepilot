import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/dashboard";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json(buildDashboard({
    contacts: store.contacts.list(),
    products: store.products.list(),
    inquiries: store.inquiries.list(),
    quotations: store.quotations.list(),
    orders: store.orders.list(),
  }));
}

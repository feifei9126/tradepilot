import { NextResponse } from "next/server";
import { buildFinanceData } from "@/lib/finance";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json(
    buildFinanceData(store.orders.list(), store.quotations.list()),
  );
}

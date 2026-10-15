import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { NextResponse } from "next/server";
import { buildFinanceData } from "@/lib/finance";
async function handleGET() {
    const store = getStore();
    return NextResponse.json(buildFinanceData((await store.orders.list()), (await store.quotations.list())));
}

export const GET = withTenant(handleGET);

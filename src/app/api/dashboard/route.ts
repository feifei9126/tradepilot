import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/dashboard";
async function handleGET() {
    const store = getStore();
    return NextResponse.json(buildDashboard({
        contacts: (await store.contacts.list()),
        products: (await store.products.list()),
        inquiries: (await store.inquiries.list()),
        quotations: (await store.quotations.list()),
        orders: (await store.orders.list()),
    }));
}

export const GET = withTenant(handleGET);

import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { NextRequest, NextResponse } from "next/server";
async function handleGET(_req: NextRequest, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    const store = getStore();
    const { id } = await context.params;
    const q = (await store.quotations.get(id));
    if (!q)
        return NextResponse.json({ error: "报价不存在" }, { status: 404 });
    return NextResponse.json(q);
}
async function handlePATCH(req: NextRequest, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    const store = getStore();
    const { id } = await context.params;
    const body = await req.json();
    const allowedStatuses = new Set([
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
    ]);
    if (typeof body.status !== "string" || !allowedStatuses.has(body.status)) {
        return NextResponse.json({ error: "报价状态无效" }, { status: 400 });
    }
    if ((await store.orders.list()).some((order) => order.quotationId === id)) {
        return NextResponse.json({ error: "已转为订单的报价不能再修改状态" }, { status: 409 });
    }
    const updated = (await store.quotations.update(id, { status: body.status }));
    if (!updated)
        return NextResponse.json({ error: "报价不存在" }, { status: 404 });
    return NextResponse.json(updated);
}

export const GET = withTenant(handleGET);
export const PATCH = withTenant(handlePATCH);

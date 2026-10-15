import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { NextRequest, NextResponse } from "next/server";
async function handleGET(req: NextRequest) {
    const store = getStore();
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (orderId)
        return NextResponse.json((await store.documents.byOrder(orderId)));
    return NextResponse.json((await store.documents.list()));
}
async function handleDELETE(req: NextRequest) {
    const store = getStore();
    try {
        const { id } = await req.json();
        if (!id)
            return NextResponse.json({ error: "ID必填" }, { status: 400 });
        const ok = (await store.documents.remove(id));
        if (ok)
            return NextResponse.json({ ok: true });
        return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }
    catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "文档删除失败" }, { status: 500 });
    }
}

export const GET = withTenant(handleGET);
export const DELETE = withTenant(handleDELETE);

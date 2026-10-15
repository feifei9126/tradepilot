import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { NextRequest, NextResponse } from "next/server";
async function handleGET() { const store = getStore(); return NextResponse.json({ bindings: (await store.bindings.getAll()) }); }
async function handleDELETE(req: NextRequest) {
    const store = getStore();
    const body = await req.json().catch(() => ({}));
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!phone)
        return NextResponse.json({ error: "手机号必填" }, { status: 400 });
    if (!(await store.bindings.remove(phone)))
        return NextResponse.json({ error: "未找到绑定账号" }, { status: 404 });
    return NextResponse.json({ success: true });
}

export const GET = withTenant(handleGET);
export const DELETE = withTenant(handleDELETE);

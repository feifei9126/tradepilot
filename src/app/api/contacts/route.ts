import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isValidEmail } from "@/lib/validation";
import { currentWorkspace } from "@/lib/workspace-context";
import { resolveContactAccess } from "@/lib/contact-access";
async function handleGET() {
    const store = getStore();
    return NextResponse.json((await store.contacts.list()));
}
async function handlePOST(req: NextRequest) {
    const store = getStore();
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name)
        return NextResponse.json({ error: "客户名称必填" }, { status: 400 });
    if (name.length > 200)
        return NextResponse.json({ error: "客户名称过长" }, { status: 400 });
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (email && !isValidEmail(email)) {
        return NextResponse.json({ error: "客户邮箱格式无效" }, { status: 400 });
    }
    const workspace = currentWorkspace();
    if (!workspace) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    const contact = {
        id: `c_${randomUUID()}`,
        name,
        country: typeof body.country === "string" ? body.country.trim().slice(0, 100) : "",
        source: typeof body.source === "string"
            ? body.source.trim().slice(0, 100)
            : "manual",
        tags: Array.isArray(body.tags)
            ? body.tags
                .filter((tag: unknown): tag is string => typeof tag === "string")
                .map((tag: string) => tag.trim())
                .filter(Boolean)
                .slice(0, 20)
            : [],
        notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 10000) : "",
        email,
        phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 80) : "",
        grade: ["A", "B", "C"].includes(body.grade) ? body.grade : undefined,
        stage: ["new", "following", "negotiating", "converted", "lost"].includes(body.stage)
            ? body.stage
            : "new",
        createdAt: new Date().toISOString().slice(0, 10),
        ...(await resolveContactAccess({ workspace, body, create: true })),
    };
    (await store.contacts.add(contact));
    return NextResponse.json(contact, { status: 201 });
}

export const GET = withTenant(handleGET);
export const POST = withTenant(handlePOST);

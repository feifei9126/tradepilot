import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { type StoredProduct } from "@/lib/store";
async function handleGET() {
    const store = getStore();
    return NextResponse.json((await store.products.list()));
}
async function handlePOST(req: NextRequest) {
    const store = getStore();
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name)
        return NextResponse.json({ error: "产品名称必填" }, { status: 400 });
    if (name.length > 200) {
        return NextResponse.json({ error: "产品名称不能超过 200 个字符" }, { status: 400 });
    }
    const image = typeof body.image === "string" ? body.image : "";
    if (image &&
        (!/^data:image\/(?:jpeg|png|webp);base64,/.test(image) ||
            image.length > 7000000)) {
        return NextResponse.json({ error: "产品图片格式无效或超过 5 MB" }, { status: 400 });
    }
    const numberOrZero = (value: unknown) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };
    const text = (value: unknown, maxLength: number) => typeof value === "string" ? value.trim().slice(0, maxLength) : "";
    const product: StoredProduct = {
        id: `p_${randomUUID()}`,
        name,
        modelNo: text(body.modelNo, 100),
        hsCode: text(body.hsCode, 50),
        category: text(body.category, 100),
        costPrice: numberOrZero(body.costPrice),
        unit: text(body.unit, 30) || "件",
        moq: numberOrZero(body.moq),
        description: text(body.description, 20000),
        media: image
            ? [
                {
                    id: `media_${randomUUID()}`,
                    type: "image",
                    url: image,
                    title: text(body.imageName, 200) || "产品图片",
                    mimeType: image.slice(5, image.indexOf(";")),
                    createdAt: new Date().toISOString(),
                },
            ]
            : [],
    };
    (await store.products.add(product));
    return NextResponse.json(product, { status: 201 });
}

export const GET = withTenant(handleGET);
export const POST = withTenant(handlePOST);

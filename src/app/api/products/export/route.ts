import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { NextResponse } from "next/server";
async function handleGET() {
    const store = getStore();
    const products = (await store.products.list());
    const header = "ID,产品名称,型号,HS编码,类别,成本价,单位,起订量";
    const rows = products.map(p => `"${p.id}","${p.name}","${p.modelNo || ""}","${p.hsCode || ""}","${p.category || ""}","${p.costPrice || 0}","${p.unit}","${p.moq || 0}"`);
    const csv = [header, ...rows].join("\n");
    return new NextResponse("\uFEFF" + csv, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="products.csv"' },
    });
}

export const GET = withTenant(handleGET);

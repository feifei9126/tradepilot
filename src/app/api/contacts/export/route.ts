import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { NextResponse } from "next/server";
function csvCell(value: unknown) {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text))
        text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}
async function handleGET() {
    const store = getStore();
    const contacts = (await store.contacts.list());
    const header = "ID,客户名称,国家,来源,标签,邮箱,电话,等级,备注,创建日期,负责人,可见范围,团队";
    const rows = contacts.map(c => [
        c.id, c.name, c.country, c.source, (c.tags || []).join("; "), c.email,
        c.phone, c.grade, c.notes, c.createdAt, c.ownerUserId, c.visibility, c.teamId,
    ].map(csvCell).join(","));
    const csv = [header, ...rows].join("\n");
    return new NextResponse("\uFEFF" + csv, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="contacts.csv"' },
    });
}

export const GET = withTenant(handleGET);

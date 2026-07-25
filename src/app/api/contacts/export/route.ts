import { NextResponse } from "next/server";
import { store } from "@/lib/store";

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const contacts = store.contacts.list();
  const header = "ID,客户名称,国家,来源,标签,邮箱,电话,等级,备注,创建日期";
  const rows = contacts.map(c => [
    c.id, c.name, c.country, c.source, (c.tags || []).join("; "), c.email,
    c.phone, c.grade, c.notes, c.createdAt,
  ].map(csvCell).join(","));
  const csv = [header, ...rows].join("\n");
  return new NextResponse("\uFEFF" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="contacts.csv"' },
  });
}

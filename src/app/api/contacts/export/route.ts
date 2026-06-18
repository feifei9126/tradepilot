import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  const contacts = store.contacts.list();
  const header = "ID,客户名称,国家,来源,标签,邮箱,电话,等级,备注,创建日期";
  const rows = contacts.map(c =>
    `"${c.id}","${c.name}","${c.country || ""}","${c.source || ""}","${(c.tags || []).join("; ")}","${c.email || ""}","${c.phone || ""}","${c.grade || ""}","${(c.notes || "").replace(/"/g, '""')}","${c.createdAt}"`
  );
  const csv = [header, ...rows].join("\n");
  return new NextResponse("\uFEFF" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="contacts.csv"' },
  });
}

import { NextRequest, NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const contacts = await repository.contacts.list();
    const header = "ID,客户名称,国家,来源,标签,邮箱,电话,等级,备注,创建日期";
    const rows = contacts.map((contact) =>
      [
        contact.id,
        contact.name,
        contact.country,
        contact.source,
        (contact.tags || []).join("; "),
        contact.email,
        contact.phone,
        contact.grade,
        contact.notes,
        contact.createdAt,
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="contacts.csv"',
      },
    });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

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
    const products = await repository.products.list();
    const header = "ID,产品名称,型号,HS编码,类别,成本价,单位,起订量";
    const rows = products.map((product) =>
      [
        product.id,
        product.name,
        product.modelNo,
        product.hsCode,
        product.category,
        product.costPrice || 0,
        product.unit,
        product.moq || 0,
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="products.csv"',
      },
    });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { searchProducts, buildProductContext, shouldSearchProducts } from "@/lib/knowledge-base/product-kb";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message) return NextResponse.json({ error: "消息不能为空" }, { status: 400 });

    const needsSearch = shouldSearchProducts(message);
    const matches = needsSearch ? searchProducts(message) : [];
    const context = buildProductContext(matches);

    return NextResponse.json({
      needsSearch,
      matchCount: matches.length,
      matches: matches.map(m => ({
        name: m.product.name,
        modelNo: m.product.modelNo,
        score: m.score,
        price: m.product.costPrice,
        description: m.product.description,
      })),
      context,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

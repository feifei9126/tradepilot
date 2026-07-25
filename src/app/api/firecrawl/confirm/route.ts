import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { assertPublicUrl } from "@/lib/firecrawl/security";
import {
  store,
  type StoredProduct,
  type StoredProductMedia,
} from "@/lib/store";

function stringValue(value: unknown, fallback = "", maxLength = 20_000) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000_000_000
    ? value
    : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { preview?: Record<string, unknown> };
    const preview = body.preview;
    if (!preview)
      return NextResponse.json({ error: "缺少抓取预览" }, { status: 400 });

    const rawSourceUrl = stringValue(preview.sourceUrl);
    if (rawSourceUrl.length > 2_048) {
      return NextResponse.json(
        { error: "来源链接超出长度限制" },
        { status: 400 },
      );
    }
    const sourceUrl = rawSourceUrl;
    if (!sourceUrl)
      return NextResponse.json({ error: "预览缺少来源链接" }, { status: 400 });
    await assertPublicUrl(sourceUrl);

    const rawMedia = Array.isArray(preview.media) ? preview.media : [];
    const media: StoredProductMedia[] = [];
    for (const item of rawMedia.slice(0, 20)) {
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      const url = stringValue(value.url);
      const type =
        value.type === "video"
          ? "video"
          : value.type === "image"
            ? "image"
            : undefined;
      if (!type || !url || url.length > 2_048) continue;
      await assertPublicUrl(url);
      media.push({
        id: randomUUID(),
        type,
        url,
        sourceUrl,
        title: stringValue(value.title, "", 200) || undefined,
        mimeType: type === "video" ? "video/*" : "image/*",
        createdAt: new Date().toISOString(),
      });
    }

    const product: StoredProduct = {
      id: `p_${randomUUID()}`,
      name: stringValue(preview.name, "未命名产品", 200),
      modelNo: stringValue(preview.modelNo, "", 100) || undefined,
      costPrice: numberValue(preview.costPrice),
      unit: stringValue(preview.unit, "件", 30),
      category: stringValue(preview.category, "", 100) || undefined,
      description: stringValue(preview.description, "", 20_000) || undefined,
      source: sourceUrl,
      media,
    };
    store.products.add(product);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "确认导入失败" },
      { status: 400 },
    );
  }
}

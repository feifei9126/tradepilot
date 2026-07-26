import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import {
  firecrawlConfirmationSecret,
  verifyFirecrawlPreview,
} from "@/lib/firecrawl/confirmation";
import { assertPublicUrl } from "@/lib/firecrawl/security";
import { getBusinessRepository } from "@/lib/repositories";
import type { StoredProductMedia } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const body = (await req.json()) as {
      preview?: Record<string, unknown>;
      confirmationToken?: unknown;
    };
    const preview = body.preview;
    if (!preview)
      return NextResponse.json({ error: "缺少抓取预览" }, { status: 400 });
    if (typeof body.confirmationToken !== "string") {
      return NextResponse.json(
        { error: "缺少抓取预览确认令牌" },
        { status: 400 },
      );
    }
    const normalized = await verifyFirecrawlPreview(
      preview,
      body.confirmationToken,
      firecrawlConfirmationSecret(),
    );
    await assertPublicUrl(normalized.sourceUrl);

    const media: StoredProductMedia[] = [];
    for (const item of normalized.media) {
      await assertPublicUrl(item.url);
      media.push({
        id: randomUUID(),
        type: item.type,
        url: item.url,
        sourceUrl: normalized.sourceUrl,
        title: item.title,
        mimeType: item.type === "video" ? "video/*" : "image/*",
        createdAt: new Date().toISOString(),
      });
    }

    const product = await repository.products.create({
      name: normalized.name,
      modelNo: normalized.modelNo,
      costPrice: normalized.costPrice,
      unit: normalized.unit,
      category: normalized.category,
      description: normalized.description,
      source: normalized.sourceUrl,
      media,
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof BusinessError) return businessErrorResponse(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "确认导入失败" },
      { status: 400 },
    );
  }
}

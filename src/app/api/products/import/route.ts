import { NextRequest, NextResponse } from "next/server";

import { scrapeWithFirecrawl } from "@/lib/firecrawl/client";
import {
  firecrawlConfirmationSecret,
  signFirecrawlPreview,
} from "@/lib/firecrawl/confirmation";
import { normalizeFirecrawlProduct } from "@/lib/firecrawl/normalize";

// Compatibility endpoint for older clients. It returns a preview and never writes
// to the product store; new clients should use /api/firecrawl/preview directly.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { url?: string };
    const sourceUrl = body.url?.trim();
    if (!sourceUrl) return NextResponse.json({ error: "请提供产品链接" }, { status: 400 });
    const data = await scrapeWithFirecrawl(sourceUrl);
    const preview = normalizeFirecrawlProduct(data, sourceUrl);
    return NextResponse.json({
      product: preview,
      preview,
      confirmationToken: await signFirecrawlPreview(
        preview,
        firecrawlConfirmationSecret(),
      ),
      requiresConfirmation: true,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Firecrawl 抓取失败" },
      { status: 502 },
    );
  }
}

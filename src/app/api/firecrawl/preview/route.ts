import { NextRequest, NextResponse } from "next/server";

import {
  scrapeWithFirecrawl,
  getFirecrawlConfig,
} from "@/lib/firecrawl/client";
import {
  firecrawlConfirmationSecret,
  signFirecrawlPreview,
} from "@/lib/firecrawl/confirmation";
import { normalizeFirecrawlProduct } from "@/lib/firecrawl/normalize";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string };
    const sourceUrl = body.url?.trim();
    if (!sourceUrl)
      return NextResponse.json({ error: "请提供产品链接" }, { status: 400 });
    if (!getFirecrawlConfig().configured) {
      return NextResponse.json(
        { error: "Firecrawl 尚未配置，请先完成一键部署或设置服务地址" },
        { status: 503 },
      );
    }

    const data = await scrapeWithFirecrawl(sourceUrl);
    const preview = normalizeFirecrawlProduct(data, sourceUrl);
    return NextResponse.json({
      preview,
      confirmationToken: await signFirecrawlPreview(
        preview,
        firecrawlConfirmationSecret(),
      ),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Firecrawl 抓取失败" },
      { status: 502 },
    );
  }
}

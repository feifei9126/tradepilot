import { NextResponse } from "next/server";

import { getFirecrawlConfig } from "@/lib/firecrawl/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getFirecrawlConfig();
  let reachable = false;
  if (config.configured && config.url) {
    try {
      await fetch(config.url, {
        headers: process.env.FIRECRAWL_API_KEY
          ? { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` }
          : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      });
      reachable = true;
    } catch {
      reachable = false;
    }
  }

  return NextResponse.json({
    configured: config.configured,
    reachable,
    managed: config.managed,
    hasApiKey: config.hasApiKey,
    url: config.url,
    version: "version" in config ? config.version : undefined,
    label: "Firecrawl",
    detail: "抓取产品页面、图片和视频链接",
    status: reachable
      ? "服务可用"
      : config.configured
        ? "已配置但无法连接"
        : ("error" in config ? config.error : undefined) || "尚未部署或配置",
  });
}

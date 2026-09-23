import { readAPIConfig } from "@/lib/api-config/store";
import { NextResponse } from "next/server";

import { getFirecrawlConfig } from "@/lib/firecrawl/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getFirecrawlConfig();
  const key = readAPIConfig().firecrawl.apiKey;
  let reachable = false;
  if (config.configured && config.url) {
    try {
      const response = await fetch(config.url, {
        redirect: "error",
        headers: key
          ? { Authorization: `Bearer ${key}` }
          : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      });
      reachable = response.ok;
      await response.body?.cancel();
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

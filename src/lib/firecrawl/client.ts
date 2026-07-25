import { assertPublicUrl } from "./security";
import type { FirecrawlScrapeResponse } from "./types";
import { getFirecrawlConfig } from "./config";

function headers() {
  const result: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.FIRECRAWL_API_KEY)
    result.Authorization = `Bearer ${process.env.FIRECRAWL_API_KEY}`;
  return result;
}

export async function scrapeWithFirecrawl(sourceUrl: string) {
  await assertPublicUrl(sourceUrl);
  const config = getFirecrawlConfig();
  if (!config.configured || !config.url) {
    throw new Error(
      ("error" in config ? config.error : undefined) ||
        "Firecrawl 尚未配置，请先完成一键部署或设置服务地址",
    );
  }

  const response = await fetch(`${config.url}/v1/scrape`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      url: sourceUrl,
      formats: ["markdown", "html", "links"],
      onlyMainContent: false,
      waitFor: 1500,
      timeout: 30_000,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const result = (await response
    .json()
    .catch(() => ({}))) as FirecrawlScrapeResponse;
  if (!response.ok || result.success === false) {
    throw new Error(
      result.error || result.message || `Firecrawl HTTP ${response.status}`,
    );
  }
  if (!result.data) throw new Error("Firecrawl 未返回页面数据");
  return result.data;
}

export { getFirecrawlConfig } from "./config";

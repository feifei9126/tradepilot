import { assertPublicUrl } from "./security";
import type { FirecrawlScrapeResponse } from "./types";

/** Cloud adapter requires an explicit workspace credential. It never reads
 * instance configuration; callers must reserve the tenant quota first. */
export async function scrapeWithFirecrawl(sourceUrl: string, tenant: { apiKey: string }) {
  await assertPublicUrl(sourceUrl);
  if (!tenant.apiKey.trim()) throw new Error("Firecrawl Cloud API Key 未配置");

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tenant.apiKey}` },
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

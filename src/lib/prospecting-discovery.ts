import { z } from "zod";
import { assertPublicUrl } from "./firecrawl/security";
import type { ProspectingRepository } from "./prospecting-repository";
import { prospecting, ProspectingError } from "./prospecting";

const searchResult = z.object({ url: z.string(), title: z.string().optional(), description: z.string().optional(), markdown: z.string().optional() }).passthrough();
type SearchResult = z.infer<typeof searchResult>;
type Search = (query: string) => Promise<SearchResult[]>;
export type DiscoverySummary = { found: number; added: number; qualified: number; rejected: number; skipped: number; errors: string[] };
const running = new Set<string>();

export async function searchPublicPages(query: string, tenant: { apiKey: string }): Promise<SearchResult[]> {
  if (!tenant.apiKey.trim()) throw new ProspectingError("请先配置本工作区的 Firecrawl Cloud Key", 503);
  let response: Response;
  try { response = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST", redirect: "error", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tenant.apiKey}` },
    body: JSON.stringify({ query, limit: 10 }), signal: AbortSignal.timeout(30_000),
  }); } catch { throw new ProspectingError("Firecrawl 搜索服务连接失败或超时", 502); }
  const result: unknown = await response.json().catch(() => ({}));
  const body = result && typeof result === "object" ? result as Record<string, unknown> : {};
  if (!response.ok || body.success === false) {
    // Never expose upstream response bodies, which may include secrets or untrusted HTML.
    throw new ProspectingError(response.status === 404 ? "当前 Firecrawl 服务不支持搜索接口 /v1/search" : `Firecrawl 搜索失败（HTTP ${response.status}）`, 502);
  }
  if (!Array.isArray(body.data)) throw new ProspectingError("Firecrawl 搜索结果格式不正确", 502);
  return body.data.slice(0, 10).flatMap(row => { const parsed = searchResult.safeParse(row); return parsed.success ? [parsed.data] : []; });
}

export async function discoverTask(scope: string, taskId: string, search: Search, validateUrl = assertPublicUrl): Promise<DiscoverySummary> {
  const task = prospecting.getTask(scope, taskId);
  const key = `${scope}:${taskId}`;
  if (running.has(key)) throw new ProspectingError("该任务正在搜索中", 409);
  if (task.lastRunAt && Date.now() - Date.parse(task.lastRunAt) < 15 * 60_000) throw new ProspectingError("每个任务至少间隔 15 分钟运行一次", 429);
  running.add(key);
  prospecting.markRun(scope, taskId);
  try {
    // Search query is built only from task configuration, never from third-party page instructions.
    const results = await search(task.keywords.slice(0, 5).join(" "));
    const summary: DiscoverySummary = { found: results.length, added: 0, qualified: 0, rejected: 0, skipped: 0, errors: [] };
    for (const row of results) {
      try {
        const name = (row.title || "").trim().slice(0, 200);
        const excerpt = (row.description || row.markdown || "").replace(/\s+/g, " ").trim().slice(0, 2000);
        if (!name || !excerpt) { summary.skipped++; continue; }
        await validateUrl(row.url);
        const lead = prospecting.automaticLead(scope, { taskId, name, sourceUrl: row.url, excerpt, email: "" });
        summary.added++;
        summary[lead.status === "qualified" ? "qualified" : "rejected"]++;
      } catch (error) {
        summary.skipped++;
        if (error instanceof ProspectingError && error.status === 409) continue; // duplicate
        if (summary.errors.length < 3) summary.errors.push(error instanceof ProspectingError ? error.message : "来源无效或无法访问");
      }
    }
    return summary;
  } catch (error) {
    prospecting.markRun(scope, taskId, error instanceof ProspectingError ? error.message : "搜索服务暂不可用");
    throw error;
  } finally { running.delete(key); }
}

/** Production entry point uses a persisted cooldown instead of the file
 * adapter's process-local Set. No network I/O while holding a DB transaction. */
export async function discoverDatabaseTask(repository: ProspectingRepository, taskId: string, search: Search, validateUrl = assertPublicUrl): Promise<DiscoverySummary> {
  const task = await repository.beginRun(taskId);
  try {
    const rows = await search(task.keywords.slice(0, 5).join(" "));
    const summary: DiscoverySummary = { found: rows.length, added: 0, qualified: 0, rejected: 0, skipped: 0, errors: [] };
    for (const row of rows) {
      try {
        const name = (row.title || "").trim().slice(0, 200);
        const excerpt = (row.description || row.markdown || "").replace(/\s+/g, " ").trim().slice(0, 2000);
        if (!name || !excerpt) { summary.skipped++; continue; }
        try { await validateUrl(row.url); }
        catch {
          summary.skipped++;
          if (summary.errors.length < 3) summary.errors.push("来源链接不允许访问或无法解析");
          continue;
        }
        const lead = await repository.lead({ taskId, name, sourceUrl: row.url, excerpt, email: "" }, true);
        summary.added++;
        summary[lead.status === "qualified" ? "qualified" : "rejected"]++;
      } catch (error) {
        if (!(error instanceof ProspectingError) || error.status >= 500) throw error;
        summary.skipped++;
        if (error.status !== 409 && summary.errors.length < 3) summary.errors.push(error.message);
      }
    }
    await repository.finishRun(task);
    return summary;
  } catch (error) {
    await repository.finishRun(task, error instanceof ProspectingError ? error.message : "搜索服务暂不可用");
    throw error;
  }
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { discoverTask, searchPublicPages } from "../../src/lib/prospecting-discovery";
import { prospecting, ProspectingError } from "../../src/lib/prospecting";

const directory = mkdtempSync(join(tmpdir(), "tradepilot-prospecting-"));
process.env.TRADEPILOT_DATA_DIR = directory;
process.on("exit", () => rmSync(directory, { recursive: true, force: true }));
function setup() {
  const scope = randomUUID();
  const persona = prospecting.persona(scope, { name: "灯具", business: "台灯", audience: "采购商", tone: "专业" });
  const task = prospecting.task(scope, { personaId: persona.id, name: "寻访", keywords: ["台灯", "采购"], source: "公开网页" });
  return { scope, task };
}

test("自动发现去重、初审、跳过无效结果，写入按租户隔离的持久化文件", async () => {
  const { scope, task } = setup();
  const summary = await discoverTask(scope, task.id, async query => {
    assert.equal(query, "台灯 采购");
    return [
      { url: "https://example.com/buyer?utm_source=search", title: "采购商需要台灯", description: "采购商正在采购台灯，欢迎联系" },
      { url: "https://example.com/buyer", title: "重复", description: "采购台灯" },
      { url: "https://example.com/other", title: "无关页面", description: "关于园艺" },
      { url: "http://127.0.0.1/admin", title: "内网", description: "采购台灯" },
      { url: "https://example.com/blank", title: "空" },
    ];
  }, async url => { if (url.includes("127.0.0.1")) throw new Error("private"); return new URL(url); });
  assert.deepEqual({ found: summary.found, added: summary.added, qualified: summary.qualified, rejected: summary.rejected, skipped: summary.skipped }, { found: 5, added: 2, qualified: 1, rejected: 1, skipped: 3 });
  const leads = prospecting.list(scope).leads;
  assert.equal(leads.find(l => l.status === "qualified")?.discovery, "automatic");
  assert.equal(leads.find(l => l.status === "rejected")?.score, 15);
  assert.equal(prospecting.list(randomUUID()).leads.length, 0);
  const filenames = readdirSync(join(directory, "prospecting"));
  assert.ok(filenames.length >= 1);
  assert.ok(filenames.some(file => readFileSync(join(directory, "prospecting", file), "utf8").includes("example.com/buyer")));
  await assert.rejects(discoverTask(scope, task.id, async () => []), (error: unknown) => error instanceof ProspectingError && error.status === 429);
});

test("服务失败留下可见错误且不吞掉已有线索", async () => {
  const { scope, task } = setup();
  await assert.rejects(discoverTask(scope, task.id, async () => { throw new ProspectingError("不支持搜索", 502); }));
  assert.equal(prospecting.getTask(scope, task.id).lastRunError, "不支持搜索");
  assert.equal(prospecting.list(scope).leads.length, 0);
});

test("没有工作区 Cloud Key 时不回退实例配置、不调用供应商", async () => {
  const previous = process.env.FIRECRAWL_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_KEY = "never-use-shared-key";
  globalThis.fetch = async () => { throw new Error("must not fetch"); };
  try { await assert.rejects(searchPublicPages("test", { apiKey: "" }), /配置本工作区/); }
  finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.FIRECRAWL_API_KEY; else process.env.FIRECRAWL_API_KEY = previous;
  }
});

test("搜索使用显式 Cloud Key、固定端点，过滤结果并安全报告供应商错误", async () => {
  const oldUrl = process.env.FIRECRAWL_API_URL;
  const oldFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_URL = "https://must-not-use-shared-config.example";
  const tenant = { apiKey: "unit-tenant-cloud-key" };
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.firecrawl.dev/v1/search");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer unit-tenant-cloud-key");
      assert.equal(init?.redirect, "error");
      assert.equal(JSON.parse(String(init?.body)).limit, 10);
      return Response.json({ success: true, data: [{ url: "https://example.com", title: "Hello", description: "world" }, { url: 23 }, {}] });
    };
    assert.equal((await searchPublicPages("采购 台灯", tenant)).length, 1);
    globalThis.fetch = async () => Response.json({ error: "not found" }, { status: 404 });
    await assert.rejects(searchPublicPages("test", tenant), /不支持搜索接口/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.FIRECRAWL_API_URL; else process.env.FIRECRAWL_API_URL = oldUrl;
  }
});

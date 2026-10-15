import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CrmError } from "./crm-repository";
import { isValidIsoDate } from "./validation";

const short = z.string().trim().min(1).max(200);
const description = z.string().trim().min(1).max(2000);
const keywords = z.array(z.string().trim().min(1).max(80)).min(1).max(20);
const sourceUrl = z.string().trim().max(2048).url().refine((value) => {
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
}, "只支持公开的 HTTP(S) 页面链接");

export const personaInput = z.object({ name: short, business: description, audience: description, tone: z.string().trim().max(200).default("专业、友好") }).strict();
export const taskInput = z.object({ personaId: z.string().uuid(), name: short, keywords, source: z.string().trim().min(1).max(80) }).strict();
export const leadInput = z.object({ taskId: z.string().uuid(), name: short, sourceUrl, excerpt: description, email: z.union([z.email(), z.literal("")]).default("") }).strict();
export const leadPatch = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "qualified", "following", "rejected"]).optional(),
  notes: z.string().trim().max(2000).optional(),
  nextFollowUpAt: z.string().refine(v => isValidIsoDate(v), "跟进日期格式不正确").optional(),
  draft: z.string().trim().max(4000).optional(),
}).strict();

export type Persona = z.infer<typeof personaInput> & { id: string; createdAt: string };
export type ProspectTask = z.infer<typeof taskInput> & { id: string; createdAt: string; lastRunAt?: string; lastRunError?: string };
export type ProspectLead = z.infer<typeof leadInput> & {
  id: string; status: "new" | "qualified" | "following" | "rejected" | "converted";
  score: number; reasons: string[]; notes: string; draft: string;
  nextFollowUpAt: string; contactId?: string; discovery?: "automatic"; createdAt: string; updatedAt: string;
};
export type ProspectingData = { personas: Persona[]; tasks: ProspectTask[]; leads: ProspectLead[] };
export class ProspectingError extends CrmError {}

function fileFor(scope: string) {
  const directory = join(process.env.TRADEPILOT_DATA_DIR || "data", "prospecting");
  return { directory, path: join(directory, `${createHash("sha256").update(scope).digest("hex")}.json`) };
}
function persist(scope: string, data: ProspectingData) {
  const { directory, path } = fileFor(scope);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify({ version: 1, data }), { flag: "wx", mode: 0o600 });
    renameSync(tmp, path);
  } finally {
    try { unlinkSync(tmp); } catch { /* renamed */ }
  }
}
function load(scope: string): ProspectingData {
  try {
    const record = JSON.parse(readFileSync(/* turbopackIgnore: true */ fileFor(scope).path, "utf8"));
    if (record.version !== 1 || !Array.isArray(record.data?.personas) || !Array.isArray(record.data?.tasks) || !Array.isArray(record.data?.leads)) throw new Error("invalid");
    return record.data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { personas: [], tasks: [], leads: [] };
    throw new Error("获客数据读取失败，不会覆盖原有文件");
  }
}

type Runtime = typeof globalThis & { __tradepilotProspecting?: Map<string, ProspectingData> };
function workspace(scope: string): ProspectingData {
  const runtime = globalThis as Runtime;
  runtime.__tradepilotProspecting ??= new Map();
  let data = runtime.__tradepilotProspecting.get(scope);
  if (!data) {
    data = load(scope);
    runtime.__tradepilotProspecting.set(scope, data);
  }
  return data;
}
function requireItem<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find(item => item.id === id);
  if (!item) throw new ProspectingError(`${label}不存在`, 404);
  return item;
}
export function canonicalUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  // Tracking parameters are not part of the identity of a public page.
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString().replace(/\/$/, "");
}
export function scoreLead(task: ProspectTask, persona: Persona, text: string) {
  const haystack = text.toLocaleLowerCase();
  const matched = task.keywords.filter(k => haystack.includes(k.toLocaleLowerCase()));
  const audienceWords = persona.audience.split(/[\s,，、。]+/).filter(w => w.length >= 2);
  const audienceMatch = audienceWords.some(w => haystack.includes(w.toLocaleLowerCase()));
  return {
    score: Math.min(100, 15 + matched.length * 25 + (audienceMatch ? 20 : 0)),
    reasons: [...matched.map(k => `命中关键词：${k}`), ...(audienceMatch ? ["符合目标客户描述"] : [])],
  };
}
export const prospecting = {
  list(scope: string): ProspectingData {
    const data = workspace(scope);
    return { personas: [...data.personas], tasks: [...data.tasks], leads: [...data.leads].reverse() };
  },
  persona(scope: string, input: unknown) {
    const data = workspace(scope);
    if (data.personas.length >= 30) throw new ProspectingError("最多创建 30 个业务人设");
    const item: Persona = { ...personaInput.parse(input), id: randomUUID(), createdAt: new Date().toISOString() };
    data.personas.push(item);
    persist(scope, data);
    return item;
  },
  task(scope: string, input: unknown) {
    const data = workspace(scope);
    const parsed = taskInput.parse(input);
    requireItem(data.personas, parsed.personaId, "业务人设");
    if (data.tasks.length >= 100) throw new ProspectingError("最多创建 100 个获客任务");
    const item: ProspectTask = { ...parsed, keywords: [...new Set(parsed.keywords)], id: randomUUID(), createdAt: new Date().toISOString() };
    data.tasks.push(item);
    persist(scope, data);
    return item;
  },
  lead(scope: string, input: unknown) {
    const data = workspace(scope);
    const parsed = leadInput.parse(input);
    const task = requireItem(data.tasks, parsed.taskId, "获客任务");
    const url = canonicalUrl(parsed.sourceUrl);
    if (data.leads.some(l => canonicalUrl(l.sourceUrl) === url)) throw new ProspectingError("该来源链接已在线索库中", 409);
    if (data.leads.length >= 1000) throw new ProspectingError("线索库已达 1000 条，请先整理已有线索");
    const persona = requireItem(data.personas, task.personaId, "业务人设");
    const { score, reasons } = scoreLead(task, persona, `${parsed.name} ${parsed.excerpt}`);
    const now = new Date().toISOString();
    const item: ProspectLead = { ...parsed, sourceUrl: url, id: randomUUID(), status: "new", score, reasons, notes: "", draft: "", nextFollowUpAt: "", createdAt: now, updatedAt: now };
    data.leads.push(item);
    persist(scope, data);
    return item;
  },
  getTask(scope: string, id: string) { return requireItem(workspace(scope).tasks, id, "获客任务"); },
  markRun(scope: string, taskId: string, error = "") {
    const task = this.getTask(scope, taskId);
    task.lastRunAt = new Date().toISOString();
    task.lastRunError = error;
    persist(scope, workspace(scope));
    return task;
  },
  automaticLead(scope: string, input: unknown) {
    const item = this.lead(scope, input);
    // A search snippet is evidence for triage, not proof that a business is a customer.
    item.status = item.score >= 60 ? "qualified" : "rejected";
    item.discovery = "automatic";
    if (item.status === "rejected") item.reasons.push("自动初筛：相关性不足");
    persist(scope, workspace(scope));
    return item;
  },
  getLead(scope: string, id: string) { return requireItem(workspace(scope).leads, id, "线索"); },
  patch(scope: string, input: unknown) {
    const parsed = leadPatch.parse(input);
    const lead = this.getLead(scope, parsed.id);
    if (lead.status === "converted") throw new ProspectingError("已转入客户库的线索不可修改", 409);
    const changes = { ...parsed };
    delete (changes as Partial<typeof changes>).id;
    Object.assign(lead, changes, { updatedAt: new Date().toISOString() });
    persist(scope, workspace(scope));
    return lead;
  },
  promote(scope: string, id: string, createContact: (lead: ProspectLead) => string) {
    const lead = this.getLead(scope, id);
    if (lead.status === "converted") throw new ProspectingError("该线索已转入客户库", 409);
    if (lead.status !== "qualified" && lead.status !== "following") throw new ProspectingError("请先审阅并标记为高意向或跟进中", 409);
    lead.contactId = createContact(lead);
    lead.status = "converted";
    lead.updatedAt = new Date().toISOString();
    persist(scope, workspace(scope));
    return lead;
  },
};

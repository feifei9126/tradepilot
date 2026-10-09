import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { CrmRepository, type RecordKind } from "./crm-repository";
import {
  canonicalUrl, personaInput, taskInput, leadInput, leadPatch, scoreLead,
  ProspectingError, type Persona, type ProspectTask, type ProspectLead,
} from "./prospecting";
import type { StoredContact } from "./store";

/** Production adapter. Every mutation, capacity check and promotion is under
 * the shared workspace transaction lock, including across web replicas. */
export class ProspectingRepository {
  constructor(private readonly store: CrmRepository) {}
  async list() {
    const [personas, tasks, leads] = await Promise.all([
      this.store.prospectPersonas.list(), this.store.prospectTasks.list(), this.store.prospectLeads.list(),
    ]);
    return { personas, tasks, leads: leads.reverse() };
  }
  private async capacity(client: PoolClient, kind: RecordKind, max: number) {
    const result = await client.query("SELECT count(*)::int AS count FROM crm_records WHERE company_id=$1 AND kind=$2", [this.store.companyId, kind]);
    if (result.rows[0].count >= max) throw new ProspectingError(`已达到 ${max} 条容量上限，请先整理已有记录`, 409);
  }
  async persona(input: unknown) {
    const item: Persona = { ...personaInput.parse(input), id: randomUUID(), createdAt: new Date().toISOString() };
    return this.store.write(async client => {
      await this.capacity(client, "prospect_personas", 30);
      await this.store.save(client, "prospect_personas", item, true);
      await this.store.auditIn(client, "prospecting.persona.create", item.id);
      return item;
    });
  }
  async task(input: unknown) {
    const parsed = taskInput.parse(input);
    const item: ProspectTask = { ...parsed, keywords: [...new Set(parsed.keywords)], id: randomUUID(), createdAt: new Date().toISOString() };
    return this.store.write(async client => {
      await this.capacity(client, "prospect_tasks", 100);
      await this.store.save(client, "prospect_tasks", item, true);
      await this.store.auditIn(client, "prospecting.task.create", item.id);
      return item;
    });
  }
  async getTask(id: string) {
    const item = await this.store.prospectTasks.get(id);
    if (!item) throw new ProspectingError("获客任务不存在", 404);
    return item;
  }
  async getLead(id: string) {
    const item = await this.store.prospectLeads.get(id);
    if (!item) throw new ProspectingError("线索不存在", 404);
    return item;
  }
  async lead(input: unknown, automatic = false) {
    const parsed = leadInput.parse(input);
    return this.store.write(async client => {
      const task = await this.store.read<ProspectTask>("prospect_tasks", parsed.taskId, client);
      if (!task) throw new ProspectingError("获客任务不存在", 404);
      const persona = await this.store.read<Persona>("prospect_personas", task.personaId, client);
      if (!persona) throw new ProspectingError("业务人设不存在", 404);
      const url = canonicalUrl(parsed.sourceUrl);
      const duplicate = await client.query("SELECT 1 FROM crm_records WHERE company_id=$1 AND kind='prospect_leads' AND data->>'sourceUrl'=$2", [this.store.companyId, url]);
      if (duplicate.rowCount) throw new ProspectingError("该来源链接已在线索库中", 409);
      await this.capacity(client, "prospect_leads", 1000);
      const { score, reasons } = scoreLead(task, persona, `${parsed.name} ${parsed.excerpt}`);
      const now = new Date().toISOString();
      const item: ProspectLead = { ...parsed, sourceUrl: url, id: randomUUID(), score, reasons, status: automatic ? (score >= 60 ? "qualified" : "rejected") : "new", notes: "", draft: "", nextFollowUpAt: "", createdAt: now, updatedAt: now };
      if (automatic) {
        item.discovery = "automatic";
        if (item.status === "rejected") item.reasons.push("自动初筛：相关性不足");
      }
      await this.store.save(client, "prospect_leads", item, true);
      await this.store.auditIn(client, "prospecting.lead.create", item.id, { automatic, score });
      return item;
    });
  }
  async patch(input: unknown) {
    const { id, ...patch } = leadPatch.parse(input);
    return this.store.write(async client => {
      const lead = await this.store.read<ProspectLead>("prospect_leads", id, client);
      if (!lead) throw new ProspectingError("线索不存在", 404);
      if (lead.status === "converted") throw new ProspectingError("已转入客户库的线索不可修改", 409);
      const updated = { ...lead, ...patch, updatedAt: new Date().toISOString() };
      await this.store.save(client, "prospect_leads", updated, false);
      await this.store.auditIn(client, "prospecting.lead.update", id);
      return updated;
    });
  }
  async promote(id: string) {
    return this.store.write(async client => {
      const lead = await this.store.read<ProspectLead>("prospect_leads", id, client);
      if (!lead) throw new ProspectingError("线索不存在", 404);
      if (lead.status !== "qualified" && lead.status !== "following") throw new ProspectingError("请先标记为高意向或跟进中；已转入的线索不能重复转入", 409);
      const task = await this.store.read<ProspectTask>("prospect_tasks", lead.taskId, client);
      const contactId = `c_${randomUUID()}`;
      const contact: StoredContact = {
        id: contactId, name: lead.name, source: `AI 获客/${task?.source || "公开网页"}`.slice(0, 100), email: lead.email,
        stage: "new", grade: lead.score >= 60 ? "A" : "B", notes: `${lead.excerpt}\n来源：${lead.sourceUrl}${lead.notes ? `\n跟进备注：${lead.notes}` : ""}`,
        nextFollowUpAt: lead.nextFollowUpAt || undefined,
        activities: [{ date: new Date().toISOString().slice(0, 10), type: "lead", note: "AI 获客转入；公开摘要不等于真实客户" }],
        createdAt: new Date().toISOString().slice(0, 10),
      };
      await this.store.save(client, "contacts", contact, true);
      const updated: ProspectLead = { ...lead, contactId, status: "converted", updatedAt: new Date().toISOString() };
      await this.store.save(client, "prospect_leads", updated, false);
      await this.store.auditIn(client, "prospecting.lead.promote", id, { contactId });
      return updated;
    });
  }
  async beginRun(id: string) {
    return this.store.write(async client => {
      const task = await this.store.read<ProspectTask>("prospect_tasks", id, client);
      if (!task) throw new ProspectingError("获客任务不存在", 404);
      // The database clock is shared by replicas. A failed search also consumes
      // cooldown, so upstream errors cannot be used to bypass the rate limit.
      const clock = await client.query("SELECT now() AS now");
      const now = new Date(clock.rows[0].now);
      if (task.lastRunAt && now.getTime() - Date.parse(task.lastRunAt) < 15 * 60_000) throw new ProspectingError("每个任务至少间隔 15 分钟运行一次（其他副本也适用）", 429);
      const updated = { ...task, lastRunAt: now.toISOString(), lastRunError: "" };
      await this.store.save(client, "prospect_tasks", updated, false);
      await this.store.auditIn(client, "prospecting.discovery.start", id);
      return updated;
    });
  }
  async finishRun(task: ProspectTask, error = "") {
    return this.store.write(async client => {
      const current = await this.store.read<ProspectTask>("prospect_tasks", task.id, client);
      if (!current || current.lastRunAt !== task.lastRunAt) return;
      await this.store.save(client, "prospect_tasks", { ...current, lastRunError: error.slice(0, 500) }, false);
      await this.store.auditIn(client, error ? "prospecting.discovery.failed" : "prospecting.discovery.completed", task.id);
    });
  }
}

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query, transaction, DatabaseUnavailableError } from "@/db";
import type {
  StoredContact, StoredProduct, StoredInquiry, StoredQuotation, StoredOrder,
  StoredShipment, StoredDocument, StoredMessage, StoredSupplier, StoredTask,
  StoredBinding, StoredEmail, StoredEmailAccount, StoredProductVideoJob,
} from "@/lib/store";
import type { Persona, ProspectTask, ProspectLead } from "./prospecting";

export class CrmError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type RecordData = { id: string };
export type RecordKind = "contacts" | "products" | "inquiries" | "quotations" | "orders" | "shipments" | "documents" | "messages" | "suppliers" | "tasks" | "bindings" | "emails" | "email_accounts" | "custom_fields" | "prospect_personas" | "prospect_tasks" | "prospect_leads" | "product_video_jobs";
type Kind = RecordKind;
type Link = [Kind, string];
export type CrmAccessOptions = { role?: string; teamId?: string };

function references(kind: Kind, data: RecordData): Link[] {
  const value = data as Record<string, unknown>;
  const links: Link[] = [];
  const add = (target: Kind, field: string, required = false) => {
    const id = value[field];
    if (typeof id === "string" && id) links.push([target, id]);
    else if (required) throw new CrmError("缺少关联记录");
  };
  if (["quotations", "orders", "inquiries", "messages", "emails", "prospect_leads"].includes(kind)) add("contacts", "contactId", kind === "quotations" || kind === "orders");
  if (kind === "product_video_jobs") add("products", "productId", true);
  if (kind === "orders") add("quotations", "quotationId", true);
  if (kind === "shipments" || kind === "documents") add("orders", "orderId", true);
  if (kind === "prospect_tasks") add("prospect_personas", "personaId", true);
  if (kind === "prospect_leads") add("prospect_tasks", "taskId", true);
  if (kind === "quotations" || kind === "orders") {
    for (const item of Array.isArray(value.items) ? value.items : []) {
      if (item?.productId) links.push(["products", item.productId]);
    }
  }
  return links;
}
function databaseError(error: unknown): never {
  if (error instanceof CrmError || error instanceof DatabaseUnavailableError) throw error;
  const code = (error as { code?: string })?.code;
  if (code === "23505") throw new CrmError("记录重复：该报价已经创建过订单、单号或来源已存在", 409);
  if (code === "23503") throw new CrmError("记录仍被其他业务使用，不能删除", 409);
  throw new DatabaseUnavailableError();
}

/** No process-wide records or implicit fallback. All statements bind company_id.
 * Relationships use composite tenant foreign keys, even though payloads are JSONB.
 * A transaction-level workspace lock serializes writes across replicas. */
export class CrmRepository {
  readonly role: string;
  readonly teamId?: string;
  constructor(readonly companyId: string, readonly actorId = "system", access: CrmAccessOptions = {}) {
    this.role = access.role || (actorId === "system" ? "system" : "member");
    this.teamId = access.teamId;
  }
  private isPrivileged() { return this.role === "owner" || this.role === "admin" || this.role === "system" || this.role === "platform-admin"; }
  private canAccessContact(data: StoredContact) {
    if (this.isPrivileged()) return true;
    // ACL-less legacy contacts remain workspace-visible. Unknown ACL values fail
    // closed instead of silently becoming workspace-visible.
    if (!data.visibility) return true;
    if (data.visibility === "workspace") return true;
    if (data.visibility === "private") return data.ownerUserId === this.actorId;
    if (data.visibility === "team") return data.ownerUserId === this.actorId || Boolean(this.teamId && data.teamId && this.teamId === data.teamId);
    return false;
  }
  private async prepareContactForSave(client: PoolClient, input: StoredContact, insert: boolean): Promise<StoredContact> {
    // Internal migrations/maintenance jobs can write without an end-user ACL.
    if (this.role === "system") return input;
    const visibilityValues = ["private", "team", "workspace"];
    const validateTeam = (teamId: unknown) => {
      if (teamId !== undefined && teamId !== null && (typeof teamId !== "string" || !/^[A-Za-z0-9_.:-]{1,100}$/.test(teamId))) {
        throw new CrmError("客户团队标识无效", 400);
      }
    };
    const validateOwner = async (ownerUserId: unknown) => {
      if (ownerUserId === undefined || ownerUserId === null || ownerUserId === "") return undefined;
      if (typeof ownerUserId !== "string" || !/^[0-9a-f-]{36}$/i.test(ownerUserId)) throw new CrmError("客户负责人无效", 400);
      const result = await client.query("SELECT id,is_active FROM users WHERE company_id=$1 AND id=$2 FOR SHARE", [this.companyId, ownerUserId]);
      if (!result.rows[0] || result.rows[0].is_active !== true) throw new CrmError("客户负责人不属于当前工作区或已停用", 400);
      return String(result.rows[0].id);
    };

    if (insert) {
      if (!this.isPrivileged()) {
        if (input.ownerUserId && input.ownerUserId !== this.actorId) throw new CrmError("普通成员不能转移客户负责人", 403);
        if (input.visibility && !visibilityValues.includes(input.visibility)) throw new CrmError("客户可见范围无效", 400);
        if (input.visibility === "workspace") throw new CrmError("普通成员不能创建工作区全员可见客户", 403);
        validateTeam(input.teamId);
        if (input.teamId && input.teamId !== this.teamId) throw new CrmError("普通成员不能转移客户团队", 403);
        const visibility = input.visibility || (this.teamId ? "team" : "private");
        const teamId = visibility === "team" ? (input.teamId || this.teamId) : undefined;
        return { ...input, ownerUserId: this.actorId, visibility, ...(teamId ? { teamId } : { teamId: undefined }) };
      }
      if (input.visibility && !visibilityValues.includes(input.visibility)) throw new CrmError("客户可见范围无效", 400);
      validateTeam(input.teamId);
      const ownerUserId = await validateOwner(input.ownerUserId || (this.actorId !== "system" ? this.actorId : undefined));
      const visibility = input.visibility || "workspace";
      const teamId = input.teamId;
      if (visibility === "team" && !teamId) throw new CrmError("团队可见客户必须指定团队", 400);
      return { ...input, ...(ownerUserId ? { ownerUserId } : {}), visibility, ...(teamId ? { teamId } : {}) };
    }

    const previous = await this.recordData("contacts", input.id, client) as StoredContact | undefined;
    if (!previous || !(await this.canAccessRecord("contacts", previous, client))) throw new CrmError("客户不存在或无权访问", 404);
    if (!this.isPrivileged()) {
      if (input.ownerUserId !== previous.ownerUserId || input.visibility !== previous.visibility || input.teamId !== previous.teamId) {
        throw new CrmError("只有客户负责人或工作区管理员可以修改客户权限", 403);
      }
      return input;
    }

    if (input.visibility && !visibilityValues.includes(input.visibility)) throw new CrmError("客户可见范围无效", 400);
    validateTeam(input.teamId);
    const ownerUserId = await validateOwner(input.ownerUserId || previous.ownerUserId || (this.actorId !== "system" ? this.actorId : undefined));
    const visibility = input.visibility || previous.visibility || "workspace";
    const teamId = input.teamId || previous.teamId;
    if (visibility === "team" && !teamId) throw new CrmError("团队可见客户必须指定团队", 400);
    return { ...input, ...(ownerUserId ? { ownerUserId } : {}), visibility, ...(teamId ? { teamId } : {}) };
  }
  private async recordData(kind: Kind, id: string, client?: PoolClient) {
    const text = "SELECT data FROM crm_records WHERE company_id=$1 AND kind=$2 AND id=$3";
    const result = client ? await client.query(text, [this.companyId, kind, id]) : await query(text, [this.companyId, kind, id]);
    return result.rows[0]?.data as RecordData | undefined;
  }
  private async canAccessData(kind: Kind, data: RecordData, client?: PoolClient, visited = new Set<string>()): Promise<boolean> {
    if (this.isPrivileged()) return true;
    if (kind === "contacts") return this.canAccessContact(data as StoredContact);
    const visitKey = `${kind}:${data.id}`;
    if (visited.has(visitKey)) return false;
    visited.add(visitKey);
    // Follow contact/order/quotation links so a member cannot access a shipment,
    // document, order, or message by guessing its own record ID.
    for (const [target, id] of references(kind, data)) {
      if (target !== "contacts" && target !== "orders" && target !== "quotations") continue;
      const linked = await this.recordData(target, id, client);
      if (!linked || !(await this.canAccessData(target, linked, client, visited))) return false;
    }
    return true;
  }
  private async canAccessRecord<T extends RecordData>(kind: Kind, data: T, client?: PoolClient) {
    return this.canAccessData(kind, data, client);
  }
  async write<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [this.companyId]);
        const company = await client.query("SELECT id FROM companies WHERE id=$1 AND is_active=true FOR SHARE", [this.companyId]);
        if (!company.rowCount) throw new CrmError("工作区已停用", 403);
        if (/^[0-9a-f-]{36}$/i.test(this.actorId)) {
          const actor = await client.query("SELECT is_active,settings FROM users WHERE company_id=$1 AND id=$2 FOR SHARE", [this.companyId, this.actorId]);
          if (actor.rows[0]?.is_active !== true || actor.rows[0]?.settings?.mustChangePassword === true) throw new CrmError("账号已停用或需要先修改临时密码", 403);
        }
        return fn(client);
      });
    } catch (error) { databaseError(error); }
  }
  async read<T extends RecordData>(kind: Kind, id: string, client?: PoolClient): Promise<T | undefined> {
    if (!id || id.length > 240) return undefined;
    const text = "SELECT data FROM crm_records WHERE company_id=$1 AND kind=$2 AND id=$3";
    const result = client ? await client.query(text, [this.companyId, kind, id]) : await query(text, [this.companyId, kind, id]);
    const data = result.rows[0]?.data as T | undefined;
    if (!data || !(await this.canAccessRecord(kind, data, client))) return undefined;
    return data;
  }
  async save<T extends RecordData>(client: PoolClient, kind: Kind, data: T, insert: boolean): Promise<T> {
    if (!data.id || data.id.length > 240) throw new CrmError("记录 ID 无效");
    const persisted = kind === "contacts"
      ? await this.prepareContactForSave(client, data as unknown as StoredContact, insert) as unknown as T
      : data;
    const links = references(kind, persisted);
    for (const [target, id] of links) {
      if (!await this.read(target, id, client)) throw new CrmError("关联记录不存在或不属于当前工作区", 404);
    }
    if (kind === "orders" && insert) {
      const order = persisted as unknown as StoredOrder;
      const quotation = await this.read<StoredQuotation>("quotations", order.quotationId!, client);
      if (!quotation || quotation.status !== "accepted") throw new CrmError("只有已接受的报价才能创建订单", 409);
      if (order.contactId !== quotation.contactId || order.totalAmount !== quotation.totalAmount || JSON.stringify(order.items) !== JSON.stringify(quotation.items)) throw new CrmError("报价已变化，请刷新后重新创建订单", 409);
    }
    const values = [this.companyId, kind, persisted.id, JSON.stringify(persisted)];
    if (insert) await client.query("INSERT INTO crm_records(company_id,kind,id,data) VALUES ($1,$2,$3,$4::jsonb)", values);
    else await client.query("UPDATE crm_records SET data=$4::jsonb,updated_at=now() WHERE company_id=$1 AND kind=$2 AND id=$3", values);
    await client.query("DELETE FROM crm_record_links WHERE company_id=$1 AND source_kind=$2 AND source_id=$3", values.slice(0, 3));
    for (const [target, id] of links) await client.query("INSERT INTO crm_record_links(company_id,source_kind,source_id,target_kind,target_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [this.companyId, kind, persisted.id, target, id]);
    return persisted;
  }
  async list<T extends RecordData>(kind: Kind, client?: PoolClient): Promise<T[]> {
    const text = "SELECT data FROM crm_records WHERE company_id=$1 AND kind=$2 ORDER BY created_at,id";
    const result = client ? await client.query(text, [this.companyId, kind]) : await query(text, [this.companyId, kind]);
    const records = result.rows.map(row => row.data as T);
    const visible: T[] = [];
    for (const record of records) if (await this.canAccessRecord(kind, record, client)) visible.push(record);
    return visible;
  }
  collection<T extends RecordData>(kind: Kind) {
    const list = () => this.list<T>(kind);
    const updateWith = async (id: string, transform: (current: T) => T) => this.write(async client => {
      const existing = await this.read<T>(kind, id, client);
      if (!existing) return null;
      const next = transform(existing);
      // Identity can never be overwritten by a patch payload.
      const saved = await this.save(client, kind, { ...next, id: existing.id }, false);
      await this.auditIn(client, `${kind}.update`, id);
      return saved;
    });
    const remove = async (id: string) => this.write(async client => {
      const existing = await this.read<T>(kind, id, client);
      if (!existing) return false;
      const result = await client.query("DELETE FROM crm_records WHERE company_id=$1 AND kind=$2 AND id=$3", [this.companyId, kind, id]);
      if (result.rowCount) await this.auditIn(client, `${kind}.delete`, id);
      return Boolean(result.rowCount);
    });
    return {
      list, get: (id: string) => this.read<T>(kind, id),
      add: (data: T) => this.write(async client => {
        const saved = await this.save(client, kind, data, true);
        await this.auditIn(client, `${kind}.create`, data.id);
        return saved;
      }),
      update: (id: string, patch: Partial<T>) => updateWith(id, current => ({ ...current, ...patch })),
      updateWith, delete: remove, remove,
      nextNo: () => this.write(async client => {
        const year = new Date().getUTCFullYear();
        const result = await client.query("INSERT INTO crm_counters(company_id,kind,year,value) VALUES ($1,$2,$3,1) ON CONFLICT(company_id,kind,year) DO UPDATE SET value=crm_counters.value+1 RETURNING value", [this.companyId, kind, year]);
        return `${kind === "quotations" ? "QTN" : "ORD"}-${year}-${String(result.rows[0].value).padStart(3, "0")}`;
      }),
    };
  }
  readonly contacts = this.collection<StoredContact>("contacts");
  readonly products = this.collection<StoredProduct>("products");
  readonly inquiries = this.collection<StoredInquiry>("inquiries");
  readonly quotations = this.collection<StoredQuotation>("quotations");
  readonly orders = this.collection<StoredOrder>("orders");
  readonly shipments = this.collection<StoredShipment>("shipments");
  readonly suppliers = this.collection<StoredSupplier>("suppliers");
  readonly tasks = this.collection<StoredTask>("tasks");
  readonly documents = { ...this.collection<StoredDocument>("documents"), byOrder: async (id: string) => (await this.documents.list()).filter(record => record.orderId === id) };
  readonly messages = {
    ...this.collection<StoredMessage>("messages"),
    byContact: async (name: string) => (await this.messages.list()).filter(record => record.contactName === name),
    unreadCount: async (channel: string) => (await this.messages.list()).filter(record => !record.read && (!channel || record.channel === channel)).length,
    markRead: (id: string) => this.messages.update(id, { read: true }),
  };
  private readonly bindingRecords = this.collection<StoredBinding & { id: string }>("bindings");
  readonly bindings = {
    get: (phone: string) => this.bindingRecords.get(phone),
    getAll: () => this.bindingRecords.list(),
    set: (phone: string, data: StoredBinding) => this.write(async client => this.save(client, "bindings", { ...data, id: phone }, !await this.read("bindings", phone, client))),
    remove: (phone: string) => this.bindingRecords.remove(phone),
  };
  readonly emails = this.collection<StoredEmail>("emails");
  readonly emailAccounts = this.collection<StoredEmailAccount>("email_accounts");
  readonly productVideoJobs = this.collection<StoredProductVideoJob>("product_video_jobs");
  readonly prospectPersonas = this.collection<Persona>("prospect_personas");
  readonly prospectTasks = this.collection<ProspectTask>("prospect_tasks");
  readonly prospectLeads = this.collection<ProspectLead>("prospect_leads");
  async auditIn(client: PoolClient, action: string, targetId?: string, details: Record<string, unknown> = {}) {
    await client.query("INSERT INTO audit_events(company_id,actor_id,action,target_id,details) VALUES ($1,$2,$3,$4,$5::jsonb)", [this.companyId, this.actorId, action, targetId || null, JSON.stringify(details)]);
  }
  async audit(actorId: string, action: string, targetId?: string, details: Record<string, unknown> = {}) {
    await query("INSERT INTO audit_events(company_id,actor_id,action,target_id,details) VALUES ($1,$2,$3,$4,$5::jsonb)", [this.companyId, actorId, action, targetId || null, JSON.stringify(details)]);
  }
  newId() { return randomUUID(); }
}

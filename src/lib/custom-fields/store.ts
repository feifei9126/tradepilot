import type { EntityFieldSchema, EntityType, WorkflowDef } from "./schema";
import { DEFAULT_SECTIONS, DEFAULT_ORDER_WORKFLOW } from "./schema";
import { getStore, currentWorkspace } from "@/lib/workspace-context";
import { CrmError } from "@/lib/crm-repository";
import type { PoolClient } from "pg";

type FieldConfiguration = { id: string; schema?: EntityFieldSchema; workflow?: WorkflowDef };
const entityTypes: EntityType[] = ["contact", "order", "product", "quotation", "shipment", "invoice", "supplier"];

function makeDefaultSchema(entityType: EntityType): EntityFieldSchema {
  const labels: Record<EntityType, string> = {
    contact: "客户", order: "订单", product: "产品",
    quotation: "报价", shipment: "出货", invoice: "发票", supplier: "供应商",
  };
  return {
    entityType, label: labels[entityType],
    sections: structuredClone(DEFAULT_SECTIONS[entityType] || []),
    fields: [], updatedAt: new Date().toISOString(),
  };
}

function requireManager() {
  if (!["owner", "admin"].includes(currentWorkspace()?.role || "")) {
    throw new CrmError("仅工作区所有者或管理员可以修改字段和流程配置", 403);
  }
}

async function requireLockedManager(client: PoolClient) {
  const actor = currentWorkspace();
  if (!actor) throw new CrmError("请先登录", 403);
  if (actor.isPlatformAdmin === true) return;
  // A role can be revoked after the HTTP/JWT check and before the write lock.
  // Re-read it under the same lock used by team and workspace management.
  const result = await client.query("SELECT role FROM users WHERE id=$1 AND company_id=$2 FOR SHARE", [actor.userId, actor.companyId]);
  if (!["owner", "admin"].includes(result.rows[0]?.role)) {
    throw new CrmError("字段和流程管理权限已失效，请重新登录", 403);
  }
}

export async function getSchema(entityType: EntityType): Promise<EntityFieldSchema> {
  const record = await getStore().read<FieldConfiguration>("custom_fields", `schema:${entityType}`);
  return record?.schema || makeDefaultSchema(entityType);
}

export async function getAllSchemas(): Promise<Record<string, EntityFieldSchema>> {
  const records = await getStore().collection<FieldConfiguration>("custom_fields").list();
  const result: Record<string, EntityFieldSchema> = {};
  for (const entityType of entityTypes) {
    result[entityType] = records.find(record => record.id === `schema:${entityType}`)?.schema || makeDefaultSchema(entityType);
  }
  return result;
}

export async function updateSchema(entityType: EntityType, data: Partial<EntityFieldSchema>): Promise<EntityFieldSchema> {
  requireManager();
  const repository = getStore();
  return repository.write(async client => {
    await requireLockedManager(client);
    const id = `schema:${entityType}`;
    const record = await repository.read<FieldConfiguration>("custom_fields", id, client);
    const existing = record?.schema || makeDefaultSchema(entityType);
    const schema: EntityFieldSchema = {
      ...existing, ...data, entityType,
      fields: data.fields || existing.fields,
      sections: data.sections || existing.sections,
      updatedAt: new Date().toISOString(),
    };
    await repository.save(client, "custom_fields", { id, schema }, !record);
    await repository.auditIn(client, "custom_fields.update", id, { fieldCount: schema.fields.length });
    return schema;
  });
}

export async function getWorkflow(): Promise<WorkflowDef> {
  const record = await getStore().read<FieldConfiguration>("custom_fields", "workflow");
  return record?.workflow || structuredClone(DEFAULT_ORDER_WORKFLOW);
}

export async function updateWorkflow(workflow: WorkflowDef): Promise<WorkflowDef> {
  requireManager();
  const repository = getStore();
  return repository.write(async client => {
    await requireLockedManager(client);
    const existing = await repository.read("custom_fields", "workflow", client);
    await repository.save(client, "custom_fields", { id: "workflow", workflow }, !existing);
    await repository.auditIn(client, "workflow.update", workflow.id, { stageCount: workflow.stages.length });
    return workflow;
  });
}

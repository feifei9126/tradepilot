// In-memory store for custom field schemas (MVP)
import type { EntityFieldSchema, EntityType, WorkflowDef } from "./schema";
import { DEFAULT_SECTIONS, DEFAULT_ORDER_WORKFLOW } from "./schema";

function makeDefaultSchema(entityType: EntityType): EntityFieldSchema {
  const labels: Record<EntityType, string> = {
    contact: "客户", order: "订单", product: "产品",
    quotation: "报价", shipment: "出货", invoice: "发票", supplier: "供应商",
  };
  return {
    entityType, label: labels[entityType],
    sections: DEFAULT_SECTIONS[entityType] || [],
    fields: [],
    updatedAt: new Date().toISOString(),
  };
}

const schemas = new Map<EntityType, EntityFieldSchema>();
let workflow: WorkflowDef = DEFAULT_ORDER_WORKFLOW;

export function getSchema(entityType: EntityType): EntityFieldSchema {
  return schemas.get(entityType) || makeDefaultSchema(entityType);
}

export function getAllSchemas(): Record<string, EntityFieldSchema> {
  const result: Record<string, EntityFieldSchema> = {};
  for (const et of ["contact","order","product","quotation","shipment","invoice","supplier"] as EntityType[]) {
    result[et] = getSchema(et);
  }
  return result;
}

export function updateSchema(entityType: EntityType, data: Partial<EntityFieldSchema>): EntityFieldSchema {
  const existing = getSchema(entityType);
  const updated: EntityFieldSchema = {
    ...existing, ...data,
    fields: data.fields || existing.fields,
    sections: data.sections || existing.sections,
    updatedAt: new Date().toISOString(),
  };
  schemas.set(entityType, updated);
  return updated;
}

export function getWorkflow(): WorkflowDef {
  return workflow;
}

export function updateWorkflow(w: WorkflowDef): WorkflowDef {
  workflow = w;
  return workflow;
}

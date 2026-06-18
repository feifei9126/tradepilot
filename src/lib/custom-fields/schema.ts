// JSON Schema 驱动的自定义字段系统
// 让用户根据自身业务定义字段和流程

export type FieldType =
  | "text" | "number" | "select" | "multiSelect"
  | "date" | "textarea" | "email" | "phone"
  | "url" | "boolean" | "color" | "currency";

export type EntityType =
  | "contact" | "order" | "product" | "quotation"
  | "shipment" | "invoice" | "supplier";

export interface FieldOption {
  label: string;
  value: string;
  color?: string;
}

export interface CustomFieldDef {
  id: string;
  name: string;
  key: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: FieldOption[];
  defaultValue?: any;
  order: number;
  section?: string;
  width?: "full" | "half" | "third";
}

export interface FieldSection {
  id: string;
  label: string;
  icon?: string;
  order: number;
}

export interface EntityFieldSchema {
  entityType: EntityType;
  label: string;
  sections: FieldSection[];
  fields: CustomFieldDef[];
  updatedAt: string;
}

export interface WorkflowStage {
  id: string;
  name: string;
  order: number;
  color: string;
  description?: string;
  assignee?: string;
  notifyDays?: number;
  requiredDocs?: string[];
  fields?: string[];
}

export interface WorkflowDef {
  id: string;
  name: string;
  entityType: "order" | "shipment";
  stages: WorkflowStage[];
  createdAt: string;
}

// 各实体默认分区
export const DEFAULT_SECTIONS: Record<EntityType, FieldSection[]> =  {
  contact: [
    { id: "basic", label: "基本信息", icon: "📋", order: 1 },
    { id: "contact_info", label: "联系方式", icon: "📞", order: 2 },
    { id: "business", label: "业务信息", icon: "💼", order: 3 },
  ],
  order: [
    { id: "basic", label: "订单信息", icon: "📦", order: 1 },
    { id: "payment", label: "付款信息", icon: "💰", order: 2 },
    { id: "logistics", label: "物流信息", icon: "🚢", order: 3 },
    { id: "production", label: "生产信息", icon: "🏭", order: 4 },
  ],
  product: [
    { id: "basic", label: "基本信息", icon: "📄", order: 1 },
    { id: "spec", label: "规格参数", icon: "📐", order: 2 },
    { id: "package", label: "包装运输", icon: "📦", order: 3 },
  ],
  quotation: [
    { id: "basic", label: "报价信息", icon: "📝", order: 1 },
    { id: "pricing", label: "价格条款", icon: "💵", order: 2 },
  ],
  shipment: [
    { id: "basic", label: "出货信息", icon: "🚢", order: 1 },
    { id: "customs", label: "报关信息", icon: "🛂", order: 2 },
  ],
  invoice: [
    { id: "basic", label: "发票信息", icon: "🧾", order: 1 },
  ],
  supplier: [
    { id: "basic", label: "基本信息", icon: "🏢", order: 1 },
    { id: "contact", label: "联系人", icon: "👤", order: 2 },
  ],
};

// 外贸订单默认流程
export const DEFAULT_ORDER_WORKFLOW: WorkflowDef = {
  id: "default-order",
  name: "外贸订单标准流程",
  entityType: "order",
  stages: [
    { id: "confirmed", name: "订单确认", order: 1, color: "#3b82f6" },
    { id: "deposit", name: "定金到账", order: 2, color: "#8b5cf6" },
    { id: "production", name: "生产中", order: 3, color: "#f59e0b" },
    { id: "inspection", name: "验货", order: 4, color: "#10b981" },
    { id: "packing", name: "包装", order: 5, color: "#06b6d4" },
    { id: "shipped", name: "已出货", order: 6, color: "#6366f1" },
    { id: "balance", name: "尾款结清", order: 7, color: "#84cc16" },
    { id: "completed", name: "已完成", order: 8, color: "#22c55e" },
  ],
  createdAt: new Date().toISOString(),
};

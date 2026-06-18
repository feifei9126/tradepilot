// ====== AI Provider Types ======
export interface AIModel {
  id: string;
  providerId: string;
  name: string;
  capabilities: ("chat" | "embedding" | "vision" | "tool_use")[];
  contextWindow: number;
}

export interface AIProviderDef {
  id: string;
  name: string;
  icon: string;
  website: string;
  docs: string;
  models: AIModel[];
  configFields?: { key: string; label: string; placeholder: string; default?: string }[];
}

export type AIProviderId = "openai" | "anthropic" | "tongyi" | "deepseek" | "ollama";

export type AITaskKey =
  | "quotation"
  | "inquiry_extraction"
  | "order_suggestion"
  | "communication_summary"
  | "document_generation"
  | "customer_analysis"
  | "embedding";

export interface UserAIConfig {
  providers: Record<string, {
    apiKey: string;
    baseUrl?: string;
    enabledModels: string[];
  }>;
  taskMapping: Record<AITaskKey, string>; // "providerId:modelId"
}

// ====== Business Types ======
export type OrderStatus =
  | "confirmed"
  | "in_production"
  | "inspection"
  | "ready"
  | "shipped"
  | "completed"
  | "cancelled";

export type QuotationStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

export type ShipmentMethod = "sea" | "air" | "express" | "truck";

export type TradeTerm = "FOB" | "CIF" | "EXW" | "DDP" | "DAP";

// ====== Form Types ======
export interface QuotationItem {
  productId?: string;
  productName: string;
  modelNo?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  notes?: string;
}

export interface OrderItem {
  productId?: string;
  productName: string;
  modelNo?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  deliveryDate?: string;
  notes?: string;
}

// ====== AI Response Types ======
export interface AIQuotationResult {
  items: QuotationItem[];
  subtotal: number;
  freight: number;
  insurance: number;
  total: number;
  profitMargin: number;
  suggestedSellingPrice: number;
  exchangeRateRisk: "low" | "medium" | "high";
  notes: string[];
}

export interface AIOrderSuggestion {
  type: "risk" | "opportunity" | "action" | "reminder";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
}

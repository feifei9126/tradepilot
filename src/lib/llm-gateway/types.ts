// LLM 网关类型定义

export interface LLMProvider {
  id: string;
  name: string;
  apiKeyEncrypted?: string;
  baseUrl: string;
  defaultModel: string;
  enabledModels: string[];
  isActive: boolean;
  createdAt?: string;
}

export interface LLMUsageRecord {
  id: string;
  providerId: string;
  model: string;
  taskKey: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  durationMs: number;
  createdAt: string;
}

export interface AITaskConfig {
  taskKey: string;
  taskName: string;
  description: string;
  providerId: string;
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
}

// 任务定义（用于设置页展示）
export const AI_TASKS: AITaskDef[] = [
  { key: "quotation", name: "报价单生成", description: "根据产品信息生成专业报价单" },
  { key: "inquiry_extraction", name: "询盘信息提取", description: "从客户询盘中提取关键需求" },
  { key: "inquiry_intent", name: "询盘意向分析", description: "分析客户意向等级和购买阶段" },
  { key: "order_suggestion", name: "跟单建议", description: "分析订单风险并给出跟单建议" },
  { key: "communication_summary", name: "沟通摘要", description: "提炼沟通记录中的关键信息" },
  { key: "email_compose", name: "邮件写作", description: "AI 辅助撰写外贸邮件" },
  { key: "translation", name: "翻译", description: "多语言商务翻译" },
  { key: "document_fill", name: "单证填充", description: "从聊天记录提取信息填充单证" },
  { key: "customer_analysis", name: "客户分析", description: "分析客户画像和跟进策略" },
];

export interface AITaskDef {
  key: string;
  name: string;
  description: string;
}

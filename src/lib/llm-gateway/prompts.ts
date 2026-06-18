// ========================================
// AI 提示词模板 — 可配置、可扩展
// 所有 prompt 集中管理，方便优化和适配不同模型
// ========================================

export interface PromptContext {
  companyName?: string;
  contactName?: string;
  customerSummary?: string;
  lastCommunication?: string;
  productInfo?: string;
  language?: string;
  tone?: string;
  wordLimit?: number;
  keyPoints?: string;
}

function fillTemplate(template: string, ctx: PromptContext): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => (ctx as any)[key] || `{${key}}`);
}

export const promptEngine = {
  // 邮件写作
  emailCompose(type: string, ctx: PromptContext): string {
    const templates: Record<string, string> = {
      cold_email: `你是一位专业的外贸业务员。请用{language}写一封开发信。
目标客户：{contactName} - {customerSummary}
产品信息：{productInfo}
要求：语气{tone}，突出产品优势，附上简要公司介绍。`,
      follow_up: `写一封跟催邮件。
客户：{contactName}
背景：{lastCommunication}
产品：{productInfo}
要求：语气{tone}，不要施压，强调为客户带来的价值。`,
      quotation_reply: `客户已收到报价，请写一封跟进邮件。
客户：{contactName}
报价内容：{productInfo}
上次沟通：{lastCommunication}
要求：语气{tone}，询问客户反馈，表达合作期待。`,
      holiday_greeting: `写一封节日问候邮件给客户{contactName}。
要求：{language}，语气友好温暖，不要推销产品。`,
      sample_request: `客户申请样品，请写一封确认邮件。
客户：{contactName}
样品信息：{productInfo}
要求：确认收到申请，告知样品费用和 shipping 安排。`,
    };
    return fillTemplate(templates[type] || templates.follow_up, ctx);
  },

  // 询盘意向分析
  inquiryIntent: `你是一位外贸客户分析专家。请分析以下客户询盘，输出 JSON 格式的分析结果：
{
  "intentLevel": "high" | "medium" | "low",
  "inquiryType": "price" | "sample" | "cooperation" | "market_research",
  "keyRequirements": ["需求1", "需求2"],
  "urgency": "urgent" | "normal" | "casual",
  "buyingStage": "awareness" | "consideration" | "decision",
  "suggestedReply": "回复策略建议",
  "redFlags": ["风险提示1"]
}

询盘内容：
{content}

客户信息：
{customerInfo}`,

  // 单证提取
  documentFill: `你是一位外贸单证专员。请从以下聊天记录或邮件中提取信息，填充单证。
以 JSON 格式输出：
{
  "buyerName": "买方公司名",
  "buyerAddress": "买方地址",
  "productDescription": "货物描述",
  "quantity": 数量,
  "unit": "单位",
  "unitPrice": 单价,
  "totalAmount": 总金额,
  "currency": "币种",
  "tradeTerm": "贸易术语",
  "portOfLoading": "装运港",
  "portOfDestination": "目的港"
}

聊天记录：
{content}`,

  // 客户背调分析
  customerAnalysis: `你是一位外贸客户调研专家。请分析以下客户信息，输出 JSON：
{
  "companyProfile": "公司简介",
  "estimatedSize": "small" | "medium" | "large",
  "businessType": "importer" | "distributor" | "retailer" | "manufacturer" | "unknown",
  "creditRisk": "low" | "medium" | "high",
  "suggestedStrategy": "跟进策略建议",
  "nextActions": ["动作1", "动作2"],
  "potentialProducts": ["可能感兴趣的产品"]
}

客户信息：
{customerInfo}
网上公开信息：
{publicInfo}`,
};

export function buildChatMessages(systemPrompt: string, userContent: string) {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
}

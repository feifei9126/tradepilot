export interface EmailPromptContext {
  contactName?: string;
  customerSummary?: string;
  lastCommunication?: string;
  productInfo?: string;
  language?: string;
  tone?: string;
}

function fillTemplate(template: string, context: EmailPromptContext) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(context[key as keyof EmailPromptContext] || "未提供"));
}

export function buildEmailPrompt(type: string, context: EmailPromptContext) {
  const templates: Record<string, string> = {
    cold_email: `你是一位专业的外贸业务员。请用{language}写一封开发信。
目标客户：{contactName} - {customerSummary}
产品信息：{productInfo}
要求：语气{tone}，不得编造认证、交期、价格或公司资质，缺少的信息应留给用户补充。`,
    follow_up: `写一封跟进邮件。
客户：{contactName}
背景：{lastCommunication}
要求：使用{language}，语气{tone}，不要施压，也不要声称已经执行未确认的事项。`,
    quotation_reply: `客户已收到报价，请写一封跟进邮件草稿。
客户：{contactName}
上次沟通：{lastCommunication}
要求：使用{language}，语气{tone}，询问客户反馈，不要虚构折扣或交期。`,
  };
  return fillTemplate(templates[type] || templates.follow_up, context);
}

export function buildEmailMessages(systemPrompt: string, userContent: string) {
  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userContent },
  ];
}

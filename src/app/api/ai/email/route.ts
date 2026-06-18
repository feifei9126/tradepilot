import { NextRequest, NextResponse } from "next/server";
import { promptEngine, buildChatMessages } from "@/lib/llm-gateway/prompts";
import { llmGateway } from "@/lib/llm-gateway";

export async function POST(req: NextRequest) {
  try {
    const { type, context } = await req.json();
    // type: cold_email | follow_up | quotation_reply | holiday_greeting | sample_request
    // context: { companyName, contactName, customerSummary, lastCommunication, productInfo, language, tone }

    const systemPrompt = promptEngine.emailCompose(type, context || {});
    const userContent = `请用${context?.language || "中文"}写一封${getTypeLabel(type)}。`;
    const messages = buildChatMessages(systemPrompt, userContent);

    const result = await llmGateway.chat("email_compose", messages, {
      temperature: 0.8,
      maxTokens: 2048,
    });

    return NextResponse.json({ content: result.content, usage: result.usage });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    cold_email: "开发信",
    follow_up: "跟催邮件",
    quotation_reply: "报价跟进",
    holiday_greeting: "节日问候",
    sample_request: "样品申请确认",
  };
  return labels[type] || "外贸邮件";
}

import { NextRequest, NextResponse } from "next/server";
import { promptEngine, buildChatMessages } from "@/lib/llm-gateway/prompts";
import { llmGateway } from "@/lib/llm-gateway";

export async function POST(req: NextRequest) {
  try {
    const { content, customerInfo } = await req.json();
    if (!content) return NextResponse.json({ error: "询盘内容不能为空" }, { status: 400 });

    const userContent = `询盘内容：${content}\n\n客户信息：${customerInfo || "无"}`;
    const messages = buildChatMessages(promptEngine.inquiryIntent, userContent);

    const result = await llmGateway.chat("inquiry_intent", messages, {
      temperature: 0.3,
      maxTokens: 1024,
    });

    try {
      const analysis = JSON.parse(result.content);
      return NextResponse.json({ analysis, usage: result.usage });
    } catch {
      return NextResponse.json({
        analysis: { intentLevel: "medium", inquiryType: "price", keyRequirements: [], rawContent: result.content },
        usage: result.usage,
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

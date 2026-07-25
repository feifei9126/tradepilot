import { NextRequest, NextResponse } from "next/server";

import { AIRequestConfigError, AIUpstreamError, callChatCompletion } from "@/lib/ai/chat-completions";
import { buildEmailMessages, buildEmailPrompt } from "@/lib/ai/email-prompts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const context = body.context || {};
    const systemPrompt = buildEmailPrompt(body.type, context);
    const messages = buildEmailMessages(
      systemPrompt,
      `请用${context.language || "中文"}写一封${getTypeLabel(body.type)}。`,
    );
    const { data } = await callChatCompletion({
      ...body,
      messages,
      temperature: 0.8,
      maxTokens: 2048,
    });
    const content = data.choices?.[0]?.message?.content || "";
    if (!content.trim()) {
      return NextResponse.json({ error: "AI 未返回有效邮件内容" }, { status: 502 });
    }
    return NextResponse.json({
      content,
      usage: data.usage || null,
    });
  } catch (error: unknown) {
    if (error instanceof AIRequestConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AIUpstreamError) {
      return NextResponse.json({ error: error.message, detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "邮件生成失败" }, { status: 500 });
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

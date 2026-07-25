import { NextRequest, NextResponse } from "next/server";
import { AIRequestConfigError, AIUpstreamError, callChatCompletion, type ChatMessage } from "@/lib/ai/chat-completions";

type AIRequestBody = {
  apiKey?: string;
  provider?: string;
  model?: string;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  requestPath?: string;
  userAgent?: string;
  customHeaders?: string;
  useProxy?: boolean;
  proxyUrl?: string;
};

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : "服务器内部错误";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as AIRequestBody;

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "需要提供消息内容" }, { status: 400 });
    }

    const { data, endpoint } = await callChatCompletion({
      ...body,
      messages: body.messages,
      maxTokens: body.maxTokens ?? 2048,
    });

    const content = data.choices?.[0]?.message?.content || "";
    if (!content.trim()) {
      return NextResponse.json({ error: "AI 未返回有效内容" }, { status: 502 });
    }
    return NextResponse.json({
      content,
      model: data.model,
      usage: data.usage || null,
      endpoint,
    });
  } catch (error: unknown) {
    if (error instanceof AIRequestConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("AI API error:", error);
    if (error instanceof AIUpstreamError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: getMessage(error) },
      { status: 500 }
    );
  }
}

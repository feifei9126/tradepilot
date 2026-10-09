import { withTenant } from "@/lib/tenant-route";
import { callConfiguredAI } from "@/lib/ai/configured";
import { aiErrorResponse } from "@/lib/ai/public-error";
import { NextRequest, NextResponse } from "next/server";
import type { ChatMessage } from "@/lib/ai/chat-completions";

type AIRequestBody = { task: string; messages?: ChatMessage[]; temperature?: number; maxTokens?: number; };

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json() as AIRequestBody;

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "需要提供消息内容" }, { status: 400 });
    }

    const { data } = await callConfiguredAI(body.task, {
      messages: body.messages,
      temperature: body.temperature,
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
    });
  } catch (error: unknown) {
    return aiErrorResponse(error);
  }
}

export const POST = withTenant(handlePOST);

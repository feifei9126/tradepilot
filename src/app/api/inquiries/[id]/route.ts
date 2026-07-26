import { NextRequest, NextResponse } from "next/server";
import {
  AIRequestConfigError,
  AIUpstreamError,
  callChatCompletion,
} from "@/lib/ai/chat-completions";
import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const { id } = await params;
    const inquiry = await repository.inquiries.get(id);
    if (!inquiry) return NextResponse.json({ error: "未找到" }, { status: 404 });
    return NextResponse.json(inquiry);
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const { id } = await params;
    const body = await req.json();
    const patch: {
      status?: "pending" | "quoted" | "converted" | "lost";
      aiReply?: string;
    } = {};
    if (["pending", "quoted", "converted", "lost"].includes(body.status)) {
      patch.status = body.status;
    }
    if (typeof body.aiReply === "string") {
      patch.aiReply = body.aiReply.trim().slice(0, 20_000);
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "没有可更新的询盘字段" },
        { status: 400 },
      );
    }
    const updated = await repository.inquiries.update(id, patch);
    if (!updated) return NextResponse.json({ error: "未找到" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return businessErrorResponse(error);
  }
}

// Generate an AI reply draft. The route never sends a message to the customer.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const { id } = await params;
    const inquiry = await repository.inquiries.get(id);
    if (!inquiry) return NextResponse.json({ error: "未找到" }, { status: 404 });
    const body = await req.json();
    const systemPrompt = `你是一位专业的外贸跟单助手。客户发来询盘，请根据以下信息生成专业、礼貌的英文回复。
询盘客户: ${inquiry.customer}
询盘主题: ${inquiry.subject}
询盘内容: ${inquiry.content}

回复要求：
1. 使用专业但友好的语气
2. 针对客户的具体问题做出回应
3. 结尾引导客户下一步行动
4. 保持在 150-200 词以内`;

    const { data } = await callChatCompletion({
      ...body,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inquiry.content },
      ],
      maxTokens: 500,
      temperature: 0.7,
    });
    const reply = data.choices?.[0]?.message?.content || "";
    if (!reply.trim()) {
      return NextResponse.json(
        { error: "AI 未返回有效回复内容" },
        { status: 502 },
      );
    }
    const updated = await repository.inquiries.update(id, {
      aiReply: reply,
      status: "quoted",
    });
    if (!updated) return NextResponse.json({ error: "未找到" }, { status: 404 });

    return NextResponse.json({ reply, status: "quoted" });
  } catch (error: unknown) {
    if (error instanceof AIRequestConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AIUpstreamError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.status },
      );
    }
    if (error instanceof BusinessError) return businessErrorResponse(error);
    return NextResponse.json(
      { error: "AI 回复生成失败" },
      { status: 500 },
    );
  }
}

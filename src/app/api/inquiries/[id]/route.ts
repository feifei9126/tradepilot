import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inquiry = store.inquiries.get(id);
  if (!inquiry) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(inquiry);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updated = store.inquiries.update(id, body);
  if (!updated) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(updated);
}

// AI auto-reply
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inquiry = store.inquiries.get(id);
  if (!inquiry) return NextResponse.json({ error: "未找到" }, { status: 404 });

  const body = await req.json();
  const { apiKey, provider, model } = body;
  if (!apiKey) return NextResponse.json({ error: "需要提供 API Key" }, { status: 400 });

  const systemPrompt = `你是一位专业的外贸跟单助手。客户发来询盘，请根据以下信息生成专业、礼貌的英文回复。
询盘客户: ${inquiry.customer}
询盘主题: ${inquiry.subject}
询盘内容: ${inquiry.content}

回复要求：
1. 使用专业但友好的语气
2. 针对客户的具体问题做出回应
3. 结尾引导客户下一步行动
4. 保持在 150-200 词以内`;

  try {
    let providerUrl = "https://api.openai.com/v1/chat/completions";
    let modelName = model || "gpt-4o";
    if (provider === "deepseek") {
      providerUrl = "https://api.deepseek.com/v1/chat/completions";
      modelName = model || "deepseek-chat";
    } else if (provider === "tongyi") {
      providerUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
      modelName = model || "qwen-max";
    }

    const response = await fetch(providerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: inquiry.content },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: `AI API 错误: ${response.status}`, detail: data }, { status: response.status });
    }

    const reply = data.choices?.[0]?.message?.content || "";
    store.inquiries.update(id, { aiReply: reply, status: "quoted" });

    return NextResponse.json({ reply, status: "quoted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

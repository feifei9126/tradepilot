import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, provider, model, messages, temperature, maxTokens } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "需要提供 API Key" }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "需要提供消息内容" }, { status: 400 });
    }

    // Determine the API endpoint based on provider
    let baseUrl = "https://api.deepseek.com";
    if (provider === "openai") baseUrl = "https://api.openai.com/v1";
    else if (provider === "tongyi") baseUrl = "https://dashscope.aliyuncs.com/api/v1";
    // deepseek default

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `AI API 错误: ${response.status}`, detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      content: data.choices?.[0]?.message?.content || "",
      model: data.model,
      usage: data.usage || null,
    });
  } catch (error: any) {
    console.error("AI API error:", error);
    return NextResponse.json(
      { error: error.message || "服务器内部错误" },
      { status: 500 }
    );
  }
}

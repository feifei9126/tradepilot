import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messageId, contactName, content, channel, apiKey, provider, model } = await req.json();
    if (!apiKey) return NextResponse.json({ error: "需要提供 API Key" }, { status: 400 });

    let baseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com";
    if (provider === "tongyi") baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
    const actualModel = model || "deepseek-chat";

    const sysPrompt = `You are a professional international trade sales assistant. 
Generate a reply to the customer message below.
Customer: ${contactName}
Channel: ${channel || "chat"}
Original message: ${content}

Guidelines:
- Reply in English for international customers
- Be professional, friendly, and helpful
- Address the customer's specific question/request
- Include clear next steps or call to action
- Keep it under 150 words
- Do NOT use placeholders like [Your Name] - use the actual context`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: actualModel,
        messages: [{ role: "system", content: sysPrompt }, { role: "user", content: content }],
        max_tokens: 500, temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "AI API error: " + response.status }, { status: response.status });

    const reply = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ reply, messageId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

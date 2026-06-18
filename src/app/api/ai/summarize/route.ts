import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, provider, model, content } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "需要提供 API Key" }, { status: 400 });
    }

    let baseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com";
    const actualModel = model || "deepseek-chat";

    const systemPrompt = `Summarize the following customer communication and return a JSON:
{
  "summary": "brief Chinese summary",
  "sentiment": "positive" | "neutral" | "negative",
  "actionItems": ["action item 1 in Chinese", "action item 2"]
}`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: actualModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Communication:\n${content}` },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `AI API 错误: ${response.status}`, detail: errorText }, { status: response.status });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "{}";

    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ summary: result, sentiment: "neutral", actionItems: [] });
    }
  } catch (error: any) {
    console.error("AI summarize error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

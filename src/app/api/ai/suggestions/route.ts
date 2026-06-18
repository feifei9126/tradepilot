import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, provider, model, orderContext } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "需要提供 API Key" }, { status: 400 });
    }

    let baseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com";
    const actualModel = model || "deepseek-chat";

    const systemPrompt = `You are an experienced international trade order management assistant.
Analyze the order context and provide actionable suggestions.
Return a JSON array of suggestions, each object with:
{
  "type": "risk" | "opportunity" | "action" | "reminder",
  "priority": "low" | "normal" | "high" | "urgent",
  "title": "short title in Chinese",
  "description": "detailed description in Chinese",
  "actionLabel": "optional action button text"
}`;

    const userPrompt = `Analyze this export order thoroughly and provide 3-4 actionable suggestions:

Order: ${orderContext.orderNo}
Status: ${orderContext.status}
Customer: ${orderContext.customerName}
Total: ${orderContext.total}
Delivery Date: ${orderContext.deliveryDate || "Not set"}
Progress: ${orderContext.progressPercent}%
Production Milestones: ${JSON.stringify(orderContext.milestones || [])}
Milestone Analysis:
- Check which milestones are approaching or overdue
- Identify bottlenecks in the production timeline
- Compare planned vs actual dates

Recent Communications: ${orderContext.recentCommunications || "None"}

Analyze:
1. Delivery risk: Is the order on track? Any overdue milestones?
2. Communication: Are there gaps in customer updates?
3. Action: What should be done today/this week?
4. Opportunity: Any upsell or efficiency opportunity?

Return JSON array: [{ type: "risk"|"opportunity"|"action"|"reminder", priority: "low"|"normal"|"high"|"urgent", title: "Chinese title", description: "Chinese description", actionLabel: "optional" }]`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `AI API 错误: ${response.status}`, detail: errorText }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Try to parse JSON from the response
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const suggestions = JSON.parse(cleaned);
      return NextResponse.json({ suggestions, raw: content });
    } catch {
      return NextResponse.json({ suggestions: [], raw: content });
    }
  } catch (error: any) {
    console.error("AI suggestions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

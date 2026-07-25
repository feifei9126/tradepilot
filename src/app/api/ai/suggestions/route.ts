import { NextRequest, NextResponse } from "next/server";
import {
  AIRequestConfigError,
  AIUpstreamError,
  callChatCompletion,
} from "@/lib/ai/chat-completions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, provider, model, orderContext } = body;
    const actualModel = model || "deepseek-chat";

    const systemPrompt = `You are an experienced international trade order management assistant.
Analyze the order context and provide actionable suggestions.
Return a JSON array of suggestions, each object with:
{
  "type": "risk" | "opportunity" | "action" | "reminder",
  "priority": "low" | "normal" | "high" | "urgent",
  "title": "short title in Chinese",
  "description": "detailed description in Chinese",
  "actionLabel": "optional; only use 创建出货 or 发送客户邮件 when that exact navigation is appropriate"
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

    const { data } = await callChatCompletion({
      ...body,
      apiKey,
      provider,
      model: actualModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    });
    const content = data.choices?.[0]?.message?.content || "[]";

    // Try to parse JSON from the response
    try {
      const cleaned = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("suggestions must be an array");
      const suggestions = parsed.slice(0, 8).filter((value: unknown) => {
        if (!value || typeof value !== "object") return false;
        const suggestion = value as Record<string, unknown>;
        return ["risk", "opportunity", "action", "reminder"].includes(String(suggestion.type))
          && ["low", "normal", "high", "urgent"].includes(String(suggestion.priority))
          && typeof suggestion.title === "string"
          && typeof suggestion.description === "string";
      }).map((value: Record<string, unknown>) => ({
        type: value.type,
        priority: value.priority,
        title: String(value.title).slice(0, 200),
        description: String(value.description).slice(0, 2_000),
        actionLabel: typeof value.actionLabel === "string" ? value.actionLabel.slice(0, 100) : undefined,
      }));
      if (suggestions.length === 0) throw new Error("no valid suggestions");
      return NextResponse.json({ suggestions, raw: content });
    } catch {
      return NextResponse.json({ error: "AI 返回的跟单建议结构无效", suggestions: [], raw: content }, { status: 502 });
    }
  } catch (error: unknown) {
    if (error instanceof AIRequestConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("AI suggestions error:", error);
    if (error instanceof AIUpstreamError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "服务器内部错误" },
      { status: 500 },
    );
  }
}

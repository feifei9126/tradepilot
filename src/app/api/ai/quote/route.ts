import { NextRequest, NextResponse } from "next/server";
import { AIRequestConfigError, AIUpstreamError, callChatCompletion } from "@/lib/ai/chat-completions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, provider, model, productInfo, customerName, country, tradeTerm } = body;
    const actualModel = model || "deepseek-chat";

    const systemPrompt = `You are a senior international trade pricing expert. 
Generate a professional quotation based on the provided information.
Return a valid JSON object with this structure:
{
  "items": [{ "productName": "string", "quantity": number, "unit": "pcs", "unitPrice": number, "amount": number }],
  "total": number,
  "profitMargin": number,
  "notes": ["string"]
}`;

    const userPrompt = `Generate a professional export quotation:

Products: ${JSON.stringify(productInfo)}
Customer: ${customerName} (${country || "Unknown"})
Trade Term: ${tradeTerm || "FOB"}

Pricing Guidelines:
- Unit price must include every cost required by the selected trade term
- For FOB: price includes product cost + domestic logistics + port fees
- For CIF: price includes product cost + freight + insurance
- Profit margin should be 15-30% depending on product type
- Consider typical MOQ discounts (5-10% for 2x MOQ, 10-15% for 3x MOQ)
- Use realistic international trade pricing

Return JSON: { items: [{productName, quantity, unit, unitPrice, amount}], subtotal, freight, insurance, total, profitMargin, notes }`;

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
    const content = data.choices?.[0]?.message?.content || "{}";

    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const quotation = JSON.parse(cleaned);
      const validItems = Array.isArray(quotation.items) && quotation.items.length > 0 && quotation.items.every((item: unknown) => {
        const candidate = item as Record<string, unknown>;
        return typeof candidate.productName === "string"
          && Number(candidate.quantity) > 0
          && Number(candidate.unitPrice) >= 0
          && Number(candidate.amount) >= 0;
      });
      if (!validItems || !Number.isFinite(Number(quotation.total)) || Number(quotation.total) <= 0) {
        return NextResponse.json({ error: "AI 返回的报价结构无效，请重试", raw: content }, { status: 502 });
      }
      const items = quotation.items.map((item: Record<string, unknown>) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        return {
          productName: String(item.productName).trim(),
          quantity,
          unit: typeof item.unit === "string" && item.unit.trim() ? item.unit.trim() : "pcs",
          unitPrice,
          amount: Math.round(quantity * unitPrice * 100) / 100,
        };
      });
      const total = Math.round(items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0) * 100) / 100;
      return NextResponse.json({ quotation: { ...quotation, items, total }, raw: content });
    } catch {
      return NextResponse.json({ error: "AI 返回内容不是有效报价 JSON，请重试", raw: content }, { status: 502 });
    }
  } catch (error: unknown) {
    if (error instanceof AIRequestConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("AI quote error:", error);
    if (error instanceof AIUpstreamError) {
      return NextResponse.json({ error: error.message, detail: error.detail }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "服务器内部错误" }, { status: 500 });
  }
}

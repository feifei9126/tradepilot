import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, provider, model, productInfo, customerName, country, tradeTerm } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "需要提供 API Key" }, { status: 400 });
    }

    let baseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com";
    const actualModel = model || "deepseek-chat";

    const systemPrompt = `You are a senior international trade pricing expert. 
Generate a professional quotation based on the provided information.
Return a valid JSON object with this structure:
{
  "items": [{ "productName": "string", "quantity": number, "unit": "pcs", "unitPrice": number, "amount": number }],
  "subtotal": number,
  "freight": number,
  "insurance": number,
  "total": number,
  "profitMargin": number,
  "notes": ["string"]
}`;

    const userPrompt = `Generate a professional export quotation:

Products: ${JSON.stringify(productInfo)}
Customer: ${customerName} (${country || "Unknown"})
Trade Term: ${tradeTerm || "FOB"}

Pricing Guidelines:
- Include product cost, estimated freight, insurance (for CIF), and profit margin
- For FOB: price includes product cost + domestic logistics + port fees
- For CIF: price includes product cost + freight + insurance
- Profit margin should be 15-30% depending on product type
- Consider typical MOQ discounts (5-10% for 2x MOQ, 10-15% for 3x MOQ)
- Use realistic international trade pricing

Return JSON: { items: [{productName, quantity, unit, unitPrice, amount}], subtotal, freight, insurance, total, profitMargin, notes }`;

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
    const content = data.choices?.[0]?.message?.content || "{}";

    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const quotation = JSON.parse(cleaned);
      return NextResponse.json({ quotation, raw: content });
    } catch {
      return NextResponse.json({ error: "解析报价失败", raw: content });
    }
  } catch (error: any) {
    console.error("AI quote error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

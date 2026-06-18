import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, platform, apiKey, provider, model } = body;

  if (!url) {
    return NextResponse.json({ error: "请提供产品链接" }, { status: 400 });
  }

  let pageHtml = "";
  try {
    const pageResp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    pageHtml = await pageResp.text();
  } catch (e: any) {
    return NextResponse.json({ error: `无法获取页面内容: ${e.message}` }, { status: 400 });
  }

  // If no AI key, do basic HTML parsing
  if (!apiKey) {
    const titleMatch = pageHtml.match(/<title[^>]*>([^<]+)</i);
    const name = titleMatch ? titleMatch[1].trim() : "未识别产品";
    // Simple price extraction
    const priceMatch = pageHtml.match(/["'\$](\d+[.,]\d{2})/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
    return NextResponse.json({
      product: { name, costPrice: price, unit: "件", source: url },
      note: "AI 未配置，仅提取了基础信息。配置 API Key 后可获得更精确的导入。",
    });
  }

  // AI-powered extraction
  const systemPrompt = `你是一位产品数据录入专家。用户从${platform || "电商网站"}导入产品页面，请从 HTML 内容中提取产品信息。

请提取以下字段（JSON 格式）：
{
  "name": "产品名称",
  "modelNo": "型号（如有）",
  "hsCode": "HS 编码（推测）",
  "costPrice": 成本价数字（仅数字，提取到的最低价）,
  "unit": "单位（件/个/套等）",
  "moq": 最小起订量数字,
  "description": "产品简短描述",
  "category": "产品类别"
}

要求：
- name 提取完整的产品名称，英文保持英文
- 如果页面有多个 SKU/变体，选择默认或第一个
- 只返回 JSON，不要其他文字
- unit 默认为 "件"`;

  try {
    let providerUrl = "https://api.openai.com/v1/chat/completions";
    let modelName = model || "gpt-4o-mini";
    if (provider === "deepseek") {
      providerUrl = "https://api.deepseek.com/v1/chat/completions";
      modelName = model || "deepseek-chat";
    } else if (provider === "tongyi") {
      providerUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
      modelName = model || "qwen-max";
    }

    // Trim HTML to avoid token limits
    const trimmedHtml = pageHtml.replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);

    const response = await fetch(providerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `URL: ${url}\n\n页面内容:\n${trimmedHtml}` },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: `AI API 错误: ${response.status}`, detail: data }, { status: response.status });
    }

    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 返回格式异常", raw: content }, { status: 500 });
    }

    const productData = JSON.parse(jsonMatch[0]);
    const product = {
      id: `p${Date.now()}`,
      name: productData.name || "导入产品",
      modelNo: productData.modelNo || "",
      hsCode: productData.hsCode || "",
      costPrice: productData.costPrice || 0,
      unit: productData.unit || "件",
      moq: productData.moq || 0,
      description: productData.description || "",
      category: productData.category || "",
      source: url,
    };

    store.products.add(product);
    return NextResponse.json({ product, raw: content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { searchProducts, buildProductContext, shouldSearchProducts } from "@/lib/knowledge-base/product-kb";

export async function POST(req: NextRequest) {
  try {
    const { contactName, contactId, content, channel, apiKey, provider, model } = await req.json();
    if (!apiKey || !content) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

    const cfg = store.autoReply.get(contactId || contactName);
    if (!cfg?.enabled) return NextResponse.json({ autoReplied: false, reason: "auto_reply_disabled" });

    let baseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com";
    if (provider === "tongyi") baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
    const actualModel = model || "deepseek-chat";
    const lang = cfg.language === "zh" ? "Chinese" : "English";

    // ===== 产品知识库检索 =====
    let productContext = "";
    const matchedProducts: { name: string; score: number; modelNo?: string }[] = [];

    if (shouldSearchProducts(content)) {
      const matches = searchProducts(content, 3);
      if (matches.length > 0) {
        productContext = buildProductContext(matches);
        matches.forEach(m => matchedProducts.push({
          name: m.product.name,
          score: m.score,
          modelNo: m.product.modelNo,
        }));
      }
    }

    // 构建系统提示词
    const sysPrompt = `你是一位专业的外贸公司 AI 销售助理。请用${lang}回复客户。
客户: ${contactName}
沟通渠道: ${channel || "chat"}
客户原始消息: ${content}

${productContext ? productContext : "注意: 当前未匹配到具体产品，请基于通用外贸知识回答。"}

回复规则:
- 必须用 ${lang} 回复
- 专业、友好、有帮助
- 针对具体问题回答
- 结尾给出明确的下一步行动
- 如果客户询价，请提供匹配产品的基本信息并引导进一步沟通
- 如果客户问产品详情，请根据提供的产品资料回答
- 最多 200 词`;

    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: actualModel,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: content },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: "AI API error: " + response.status, autoReplied: false }, { status: 502 });
    }

    const reply = data.choices?.[0]?.message?.content || "";
    if (!reply) return NextResponse.json({ error: "AI returned empty", autoReplied: false }, { status: 500 });

    // 保存消息
    const msg = {
      id: "mauto" + Date.now(),
      contactId: contactId || "",
      contactName,
      channel: channel || "other",
      content: reply,
      direction: "out" as const,
      read: true,
      aiReply: "",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    store.messages.add(msg);

    return NextResponse.json({
      autoReplied: true,
      reply,
      messageId: msg.id,
      productsUsed: matchedProducts.length > 0 ? matchedProducts : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, autoReplied: false }, { status: 500 });
  }
}

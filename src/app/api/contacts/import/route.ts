import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { chatText, source, apiKey, provider, model } = body;

  if (!chatText) {
    return NextResponse.json({ error: "请提供聊天记录内容" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "需要提供 API Key 用于 AI 解析" }, { status: 400 });
  }

  const systemPrompt = `你是一位外贸数据录入专家。用户上传了${source || "聊天软件"}的聊天记录，请从中提取客户信息。

请提取以下字段（JSON 格式）：
{
  "contacts": [
    {
      "name": "客户名/公司名",
      "country": "国家（推测）",
      "phone": "电话（如有）",
      "email": "邮箱（如有）",
      "source": "${source || "聊天导入"}",
      "tags": ["标签1", "标签2"],
      "notes": "从聊天中提取的关键信息，如询价产品、意向等"
    }
  ]
}

要求：
- 如果聊天记录中有多个客户，提取所有客户
- name 字段尽量提取公司名或联系人名
- country 根据对话内容推测客户所在国家
- tags 自动打标签，如 "电子", "大客户", "新客户", "待跟进" 等
- notes 用中文总结聊天中的业务要点
- 只返回 JSON，不要其他文字`;

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

    const response = await fetch(providerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: chatText.slice(0, 6000) },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: `AI API 错误: ${response.status}`, detail: data }, { status: response.status });
    }

    const content = data.choices?.[0]?.message?.content || "";
    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { contacts: [] };

    // Save to store
    const saved = (parsed.contacts || []).map((c: any) => {
      const contact = {
        id: `c${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: c.name || "未知客户",
        country: c.country || "",
        source: c.source || source || "聊天导入",
        tags: c.tags || [],
        notes: c.notes || "",
        email: c.email || "",
        phone: c.phone || "",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      store.contacts.add(contact);
      return contact;
    });

    return NextResponse.json({ contacts: saved, raw: content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store, type StoredContact } from "@/lib/store";
import { isValidEmail } from "@/lib/validation";
import {
  AIRequestConfigError,
  AIUpstreamError,
  callChatCompletion,
} from "@/lib/ai/chat-completions";

interface ImportedContact {
  name?: string;
  country?: string;
  source?: string;
  tags?: string[];
  notes?: string;
  email?: string;
  phone?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const chatText =
    typeof body.chatText === "string" ? body.chatText.trim() : "";
  const source =
    typeof body.source === "string"
      ? body.source.trim().slice(0, 100)
      : "聊天导入";

  if (!chatText) {
    return NextResponse.json({ error: "请提供聊天记录内容" }, { status: 400 });
  }
  if (chatText.length > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: "聊天记录内容不能超过 2 MB" },
      { status: 413 },
    );
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
    const { data } = await callChatCompletion({
      ...body,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: String(chatText).slice(0, 6000) },
      ],
      maxTokens: 2000,
      temperature: 0.3,
    });

    const content = data.choices?.[0]?.message?.content || "";
    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = (
      jsonMatch ? JSON.parse(jsonMatch[0]) : { contacts: [] }
    ) as { contacts?: ImportedContact[] };

    // Save to store
    const contacts = (Array.isArray(parsed.contacts) ? parsed.contacts : [])
      .filter(
        (contact) => typeof contact.name === "string" && contact.name.trim(),
      )
      .slice(0, 100);
    if (contacts.length === 0) {
      return NextResponse.json(
        { error: "AI 未提取到有效客户，请检查聊天内容后重试" },
        { status: 422 },
      );
    }

    const saved = contacts.map((c) => {
      const contact: StoredContact = {
        id: `c_${randomUUID()}`,
        name: c.name!.trim().slice(0, 200),
        country:
          typeof c.country === "string" ? c.country.trim().slice(0, 100) : "",
        source:
          typeof c.source === "string" ? c.source.trim().slice(0, 100) : source,
        tags: Array.isArray(c.tags)
          ? c.tags
              .filter((tag): tag is string => typeof tag === "string")
              .map((tag) => tag.trim().slice(0, 100))
              .filter(Boolean)
              .slice(0, 20)
          : [],
        notes:
          typeof c.notes === "string" ? c.notes.trim().slice(0, 10_000) : "",
        email:
          typeof c.email === "string" && isValidEmail(c.email.trim())
            ? c.email.trim()
            : "",
        phone: typeof c.phone === "string" ? c.phone.trim().slice(0, 80) : "",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      store.contacts.add(contact);
      return contact;
    });

    return NextResponse.json({ contacts: saved, raw: content });
  } catch (error: unknown) {
    if (error instanceof AIRequestConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AIUpstreamError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "聊天记录导入失败" },
      { status: 500 },
    );
  }
}

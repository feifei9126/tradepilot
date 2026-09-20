import { RoomServiceClient } from "livekit-server-sdk";
import { z } from "zod";
import {
  boundedJson,
  configAccess,
  mutationOrigin,
} from "@/lib/api-config/access";
import { readAPIConfig } from "@/lib/api-config/store";
import { voiceKey } from "@/lib/api-config/schema";
import { resolveTextRequest } from "@/lib/api-config/resolve";
import { callChatCompletion } from "@/lib/ai/chat-completions";
export const runtime = "nodejs";
const attempts: number[] = [];
export async function POST(request: Request) {
  const denied = (await configAccess(true)) || mutationOrigin(request);
  if (denied) return denied;
  const now = Date.now();
  while (attempts.length && attempts[0] < now - 60000) attempts.shift();
  if (attempts.length >= 10)
    return Response.json(
      { error: "测试过于频繁，请一分钟后重试" },
      { status: 429 },
    );
  attempts.push(now);
  try {
    const { service } = z
      .object({
        service: z.enum([
          "text",
          "voice",
          "livekit",
          "firecrawl",
          "video",
          "moneyprinter",
        ]),
      })
      .strict()
      .parse(await boundedJson(request));
    const c = readAPIConfig();
    let detail = "";
    if (service === "text") {
      const { data } = await callChatCompletion(
        resolveTextRequest({ ...c, tasks: {} }, "inquiry_reply", {
          messages: [{ role: "user", content: "Reply with OK." }],
          maxTokens: 1024,
          temperature: 0,
        }),
      );
      if (!data.choices?.[0]?.message?.content?.trim())
        throw new Error(
          "模型未返回正文；推理模型可能耗尽测试的 1024 token 额度，请使用适合短文本的模型后重试",
        );
      detail =
        "默认文本模型实际请求成功（最多 1024 输出 token，此测试可能产生费用）";
    } else if (service === "livekit") {
      if (!c.livekit.url || !c.livekit.apiKey || !c.livekit.apiSecret)
        throw new Error("请先填写 LiveKit 连接信息");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          new RoomServiceClient(
            c.livekit.url.replace(/^wss:/, "https:"),
            c.livekit.apiKey,
            c.livekit.apiSecret,
          ).listRooms(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("LiveKit 检测超时")),
              8000,
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      detail =
        "LiveKit 服务鉴权通过；不代表 Agent Worker 已在线，请在语音页验证实际会话";
    } else {
      let url: string;
      const headers: Record<string, string> = {};
      if (service === "voice") {
        const key = voiceKey(c);
        if (!key)
          throw new Error(
            "请填写 OpenAI 语音密钥，或选择复用官方 OpenAI 文本密钥",
          );
        url = "https://api.openai.com/v1/models";
        headers.Authorization = `Bearer ${key}`;
      } else if (service === "firecrawl") {
        url = c.firecrawl.url;
        if (c.firecrawl.apiKey)
          headers.Authorization = `Bearer ${c.firecrawl.apiKey}`;
      } else if (service === "video")
        url = c.video.url ? `${c.video.url.replace(/\/$/, "")}/health` : "";
      else {
        url = c.moneyprinter.url
          ? `${c.moneyprinter.url.replace(/\/$/, "")}/api/v1/tasks?page=1&page_size=1`
          : "";
        if (c.moneyprinter.apiKey) headers["x-api-key"] = c.moneyprinter.apiKey;
      }
      if (!url) throw new Error("请先填写服务地址并保存");
      const response = await fetch(url, {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`服务返回 HTTP ${response.status}`);
      if (service === "video") {
        const body = await response.json();
        if (body.ok === false) throw new Error("视频服务报告未就绪");
      } else await response.body?.cancel();
      detail =
        service === "voice"
          ? "OpenAI 密钥验证通过；Realtime 模型权限、音色和实际通话仍需实测"
          : service === "firecrawl"
            ? "Firecrawl 地址可达；请用产品链接预览验证抓取 API 权限"
            : "服务连接成功；完整视频渲染仍需真实素材验证";
    }
    return Response.json(
      { ok: true, detail },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Do not echo upstream bodies or SDK exceptions that can contain headers/credentials.
    const safe =
      error instanceof z.ZodError
        ? "测试参数无效"
        : error instanceof Error &&
            /^(请|服务返回 HTTP|视频服务报告|模型未返回|LiveKit 检测)/.test(
              error.message,
            )
          ? error.message
          : "连接测试失败，请检查地址、密钥、模型权限及服务是否启动";
    return Response.json({ ok: false, error: safe }, { status: 400 });
  }
}

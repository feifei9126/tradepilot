import { findRecommendedOllamaModel } from "@/lib/ollama/recommended-models";
import { normalizeOllamaBaseUrl } from "@/lib/ollama/base-url";

export const runtime = "nodejs";

type DeployRequest = {
  model?: string;
  baseUrl?: string;
};

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

export async function POST(request: Request) {
  let body: DeployRequest;

  try {
    body = await request.json() as DeployRequest;
  } catch {
    return Response.json({ ok: false, error: "请求格式错误" }, { status: 400 });
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  const modelInfo = findRecommendedOllamaModel(model);
  if (!modelInfo) {
    return Response.json({ ok: false, error: "不支持部署未在推荐清单中的模型" }, { status: 400 });
  }

  let baseUrl: string;
  try {
    baseUrl = normalizeOllamaBaseUrl(body.baseUrl);
  } catch (error: unknown) {
    return Response.json({ ok: false, error: getMessage(error) }, { status: 400 });
  }

  try {
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: false }),
      signal: AbortSignal.timeout(30 * 60 * 1000),
    });

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      return Response.json(
        { ok: false, error: `Ollama 返回 HTTP ${response.status}`, detail: payload },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      model,
      label: modelInfo.label,
      message: "模型部署完成",
      detail: payload,
    });
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: `无法连接 Ollama: ${getMessage(error)}` },
      { status: 502 }
    );
  }
}

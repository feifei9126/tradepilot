type OllamaTag = {
  name?: string;
  size?: number;
};

type OllamaTagsResponse = {
  models?: OllamaTag[];
};

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const baseUrl = normalizeOllamaBaseUrl(searchParams.get("baseUrl") || undefined);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return Response.json({ error: `HTTP ${res.status}` }, { status: 502 });
    const data = await res.json() as OllamaTagsResponse;
    const models = (data.models || []).filter((m) => m.name).map((m) => ({
      name: m.name, size: m.size,
      sizeLabel: m.size ? (m.size / 1e9 >= 1 ? `${(m.size / 1e9).toFixed(1)} GB` : `${(m.size / 1e6).toFixed(0)} MB`) : "未知",
    }));
    return Response.json({ ok: true, models });
  } catch (error: unknown) {
    return Response.json({ error: `无法连接 Ollama: ${getMessage(error)}` }, { status: 502 });
  }
}
import { normalizeOllamaBaseUrl } from "@/lib/ollama/base-url";

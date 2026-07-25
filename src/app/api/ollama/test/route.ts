type OllamaTagsResponse = {
  models?: unknown[];
};

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const baseUrl = normalizeOllamaBaseUrl(searchParams.get("baseUrl") || undefined);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return Response.json({ ok: false, error: `HTTP ${res.status}` });
    const data = await res.json() as OllamaTagsResponse;
    return Response.json({ ok: true, modelCount: (data.models || []).length });
  } catch (error: unknown) {
    return Response.json({ ok: false, error: getMessage(error) }, { status: 502 });
  }
}
import { normalizeOllamaBaseUrl } from "@/lib/ollama/base-url";

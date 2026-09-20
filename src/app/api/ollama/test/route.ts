type OllamaTagsResponse = {
  models?: unknown[];
};

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

export async function GET() {
  const denied = await configAccess(true);
  if (denied) return denied;
  try {
    const { baseUrl, headers } = configuredOllama();
    const res = await fetch(`${baseUrl}/api/tags`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok)
      return Response.json({ ok: false, error: `HTTP ${res.status}` });
    const data = (await res.json()) as OllamaTagsResponse;
    return Response.json({ ok: true, modelCount: (data.models || []).length });
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: getMessage(error) },
      { status: 502 },
    );
  }
}
import { configuredOllama } from "@/lib/ollama/configured";
import { configAccess } from "@/lib/api-config/access";

import { TenantAIError } from "@/lib/tenant-ai";
import { AIRequestConfigError, AIUpstreamError } from "@/lib/ai/chat-completions";

const privateHeaders = { "Cache-Control": "no-store, private" };

export function publicAIError(error: unknown): { status: number; message: string } {
  if (error instanceof TenantAIError) {
    return { status: error.status, message: error.message };
  }
  if (error instanceof AIRequestConfigError) {
    return { status: error.status, message: error.message };
  }
  if (error instanceof AIUpstreamError) {
    if (error.status === 401 || error.status === 403) {
      return { status: 502, message: "AI 服务商鉴权失败，请检查工作区 AI Key 和服务配置。" };
    }
    if (error.status === 429) {
      return { status: 503, message: "AI 服务商当前请求繁忙，请稍后重试。" };
    }
    return { status: 502, message: "AI 服务暂时不可用，请检查外部服务配置或稍后重试。" };
  }
  // Error messages can contain upstream URLs, request fragments, or provider
  // diagnostics. Keep those details in controlled server-side observability only.
  return { status: 503, message: "AI 服务暂时不可用，请稍后重试。" };
}

export function aiErrorResponse(error: unknown) {
  const safe = publicAIError(error);
  return Response.json({ error: safe.message }, { status: safe.status, headers: privateHeaders });
}

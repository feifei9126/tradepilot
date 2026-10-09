import { configAccess } from "../api-config/access";
import { readAPIConfig } from "../api-config/store";
import { resolveTextRequest } from "../api-config/resolve";
import { currentWorkspace } from "@/lib/workspace-context";
import { finishTenantAIRequest, reserveTenantAIRequest } from "@/lib/tenant-ai";
import {
  AIRequestConfigError,
  callChatCompletion,
  type ChatCompletionRequest,
} from "./chat-completions";

export async function callConfiguredAI(
  task: string,
  input: Pick<ChatCompletionRequest, "messages" | "temperature" | "maxTokens">,
) {
  const workspace = currentWorkspace();
  // Platform AI credentials remain instance-owned. A tenant may never fall back
  // to them: tenant calls require its own key and usage reservation.
  if (workspace && !workspace.isPlatformAdmin) {
    const reservation = await reserveTenantAIRequest(workspace.companyId, workspace.userId, task, input);
    try {
      const response = await callChatCompletion({
        provider: reservation.provider,
        apiKey: reservation.apiKey,
        baseUrl: reservation.baseUrl,
        model: reservation.model,
        requestPath: "/chat/completions",
        messages: input.messages,
        temperature: input.temperature,
        maxTokens: reservation.maxTokens,
      });
      const usage = response.data?.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
      await finishTenantAIRequest(reservation.id, {
        ok: true,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        fallbackTokens: reservation.reservedTokens,
      });
      return response;
    } catch (error) {
      await finishTenantAIRequest(reservation.id, {
        ok: false,
        fallbackTokens: reservation.reservedTokens,
        failureCode: error instanceof Error ? error.name : "provider_error",
      }).catch(() => {});
      if (error instanceof AIRequestConfigError) throw error;
      throw error;
    }
  }
  const denied = await configAccess();
  if (denied) throw new AIRequestConfigError("无权使用此实例的 AI 配置", denied.status);
  return callChatCompletion(resolveTextRequest(readAPIConfig(), task, input));
}

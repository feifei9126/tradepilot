import { configAccess } from "../api-config/access";
import { readAPIConfig } from "../api-config/store";
import { resolveTextRequest } from "../api-config/resolve";
import {
  AIRequestConfigError,
  callChatCompletion,
  type ChatCompletionRequest,
} from "./chat-completions";
export async function callConfiguredAI(
  task: string,
  input: Pick<ChatCompletionRequest, "messages" | "temperature" | "maxTokens">,
) {
  const denied = await configAccess();
  if (denied)
    throw new AIRequestConfigError("无权使用此实例的 AI 配置", denied.status);
  return callChatCompletion(resolveTextRequest(readAPIConfig(), task, input));
}

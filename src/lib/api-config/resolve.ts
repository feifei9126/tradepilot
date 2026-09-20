import { AI_TASKS, textReady, type APIConfig } from "./schema";
import {
  AIRequestConfigError,
  type ChatCompletionRequest,
} from "../ai/chat-completions";
export function resolveTextRequest(
  config: APIConfig,
  task: string,
  input: Pick<ChatCompletionRequest, "messages" | "temperature" | "maxTokens">,
): ChatCompletionRequest {
  if (!Object.hasOwn(AI_TASKS, task))
    throw new AIRequestConfigError("未知的 AI 功能");
  if (!textReady(config))
    throw new AIRequestConfigError(
      "请先在「系统 → API 配置中心」完成文本模型配置",
    );
  // Never spread a client request into provider configuration: clients select a task, not a credential destination.
  return {
    ...config.text,
    model: config.tasks[task] || config.text.model,
    messages: input.messages,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  };
}

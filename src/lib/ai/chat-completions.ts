import { TEXT_PROVIDERS, type TextProviderId } from "../api-config/providers";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionRequest = {
  apiKey?: string;
  provider?: string;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  requestPath?: string;
  userAgent?: string;
  customHeaders?: string;
  useProxy?: boolean;
  proxyUrl?: string;
};

function defaultBaseUrl(provider: string) {
  // Keep the non-Docker low-level Ollama fallback for existing callers.
  if (provider === "ollama") return "http://localhost:11434/v1";
  return Object.hasOwn(TEXT_PROVIDERS, provider)
    ? TEXT_PROVIDERS[provider as TextProviderId].baseUrl
    : "";
}

export class AIUpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "AIUpstreamError";
  }
}

export class AIRequestConfigError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AIRequestConfigError";
  }
}

function normalizeUrl(value: string, fallbackProvider: string) {
  const raw = value.trim() || defaultBaseUrl(fallbackProvider);
  try {
    const url = new URL(raw);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      throw new AIRequestConfigError(
        "API 请求地址必须以 http:// 或 https:// 开头",
      );
    }
    return url.toString().replace(/\/$/, "");
  } catch (error: unknown) {
    if (error instanceof AIRequestConfigError) throw error;
    throw new AIRequestConfigError("API 请求地址格式不正确");
  }
}

export function buildChatCompletionUrl(
  config: Pick<
    ChatCompletionRequest,
    "provider" | "baseUrl" | "requestPath" | "useProxy" | "proxyUrl"
  >,
) {
  const provider = config.provider || "deepseek";
  if (config.useProxy && config.proxyUrl?.trim()) {
    return normalizeUrl(config.proxyUrl, provider);
  }

  const baseUrl = normalizeUrl(
    config.baseUrl || defaultBaseUrl(provider),
    provider,
  );
  const rawPath = config.requestPath?.trim() || "/chat/completions";
  if (/^https?:\/\//.test(rawPath)) return normalizeUrl(rawPath, provider);
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return `${baseUrl}${path}`;
}

function parseCustomHeaders(value: string | undefined) {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const headers: Record<string, string> = {};
    Object.entries(parsed).forEach(([key, headerValue]) => {
      if (typeof headerValue === "string") headers[key] = headerValue;
    });
    return headers;
  } catch {
    throw new AIRequestConfigError("自定义 Headers 必须是合法 JSON");
  }
}

export async function callChatCompletion(config: ChatCompletionRequest) {
  const provider = config.provider || "deepseek";
  if (!config.apiKey && provider !== "ollama") {
    throw new AIRequestConfigError("需要提供 API Key");
  }
  if (
    !Array.isArray(config.messages) ||
    config.messages.length === 0 ||
    config.messages.length > 50
  ) {
    throw new AIRequestConfigError("消息数量必须在 1 到 50 条之间");
  }
  const validMessages = config.messages.every(
    (message) =>
      message != null &&
      ["system", "user", "assistant"].includes(message.role) &&
      typeof message.content === "string" &&
      message.content.length > 0 &&
      message.content.length <= 50_000,
  );
  if (!validMessages)
    throw new AIRequestConfigError("消息内容格式无效或超出长度限制");
  const totalLength = config.messages.reduce(
    (sum, message) => sum + message.content.length,
    0,
  );
  if (!validMessages || totalLength > 100_000) {
    throw new AIRequestConfigError("消息内容格式无效或超出长度限制");
  }

  const endpoint = buildChatCompletionUrl(config);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...parseCustomHeaders(config.customHeaders),
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  if (config.userAgent?.trim()) headers["User-Agent"] = config.userAgent.trim();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers,
      body: JSON.stringify({
        model: config.model || "deepseek-chat",
        messages: config.messages,
        // New vendor/aggregator models may reject fixed temperatures. Use their defaults.
        ...(["openai", "deepseek", "tongyi", "ollama", "custom"].includes(
          provider,
        )
          ? {
              temperature: Math.min(
                2,
                Math.max(0, Number(config.temperature ?? 0.7)),
              ),
            }
          : {}),
        max_tokens: Math.min(
          8192,
          Math.max(1, Number(config.maxTokens) || 2048),
        ),
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    // Fetch/Headers exceptions may include a sensitive header value. Never expose them.
    throw new AIUpstreamError(
      "AI 接口连接失败，请检查地址、网络和鉴权配置",
      502,
    );
  }
  const text = await response.text();
  if (!response.ok) {
    throw new AIUpstreamError(
      `AI API 错误: ${response.status}`,
      response.status,
      undefined,
    );
  }

  try {
    const data = text ? JSON.parse(text) : {};
    return { data, endpoint };
  } catch {
    throw new AIUpstreamError("AI 接口返回了无效 JSON", 502);
  }
}

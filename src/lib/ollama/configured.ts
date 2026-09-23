import { readAPIConfig } from "@/lib/api-config/store";
import { normalizeOllamaBaseUrl } from "./base-url";

export function configuredOllama() {
  const { text } = readAPIConfig();
  if (text.provider !== "ollama" || !text.baseUrl) {
    throw new Error("请在 API 配置中心保存 Ollama 提供商与地址");
  }
  const headers: Record<string, string> = text.customHeaders
    ? JSON.parse(text.customHeaders)
    : {};
  if (text.apiKey) headers.Authorization = `Bearer ${text.apiKey}`;
  return { baseUrl: normalizeOllamaBaseUrl(text.baseUrl), headers };
}

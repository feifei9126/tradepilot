export function normalizeOllamaBaseUrl(value: string | undefined) {
  const raw = value?.trim() || "http://localhost:11434";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Ollama 地址格式无效");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Ollama 地址必须是不含凭据的 HTTP(S) URL");
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/v1\/?$/, "").replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}

import { z } from "zod";
import { TEXT_PROVIDER_IDS, providerTextDefaults } from "./providers";

export const AI_TASKS = {
  inquiry_reply: "询盘回复",
  email_compose: "邮件撰写",
  message_reply: "文字客服",
  customer_analysis: "客户分析",
  contact_import: "客户资料识别",
  product_enrichment: "产品资料补全",
  quotation: "智能报价",
  order_suggestion: "跟单建议",
  lead_generation: "AI 获客文案",
  video_script: "产品视频脚本",
} as const;
export type AITask = keyof typeof AI_TASKS;
export const SECRET_FIELDS = [
  "text.apiKey",
  "text.customHeaders",
  "firecrawl.apiKey",
  "moneyprinter.apiKey",
  "livekit.apiKey",
  "livekit.apiSecret",
  "voice.apiKey",
] as const;
export type SecretField = (typeof SECRET_FIELDS)[number];
const text = z.string().trim().max(2048);
const secret = z.string().trim().max(8192);
const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, "请输入不含账号、查询参数的 HTTP(S) 地址");
export const configSchema = z
  .object({
    text: z
      .object({
        provider: z.enum(TEXT_PROVIDER_IDS),
        baseUrl: httpUrl,
        apiKey: secret,
        model: text,
        requestPath: text.refine(
          (v) => /^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(v),
          "请求路径应为 /chat/completions 形式",
        ),
        customHeaders: secret.refine((v) => {
          if (!v) return true;
          try {
            const h = JSON.parse(v);
            return (
              h &&
              typeof h === "object" &&
              !Array.isArray(h) &&
              Object.entries(h).every(
                ([k, val]) =>
                  /^[A-Za-z0-9-]+$/.test(k) &&
                  typeof val === "string" &&
                  !/[\r\n]/.test(val) &&
                  ![
                    "host",
                    "authorization",
                    "cookie",
                    "content-length",
                  ].includes(k.toLowerCase()),
              )
            );
          } catch {
            return false;
          }
        }, "Headers 必须是字符串值 JSON，不能覆盖鉴权、Cookie 或 Host"),
      })
      .strict(),
    tasks: z
      .record(z.string(), text)
      .refine(
        (v) => Object.keys(v).every((k) => Object.hasOwn(AI_TASKS, k)),
        "未知的 AI 功能",
      ),
    firecrawl: z.object({ url: httpUrl, apiKey: secret }).strict(),
    video: z.object({ url: httpUrl }).strict(),
    moneyprinter: z.object({ url: httpUrl, apiKey: secret }).strict(),
    livekit: z
      .object({
        url: text.refine((v) => {
          if (!v) return true;
          try {
            const u = new URL(v);
            return (
              u.protocol === "wss:" &&
              !u.username &&
              !u.password &&
              !u.search &&
              !u.hash
            );
          } catch {
            return false;
          }
        }, "LiveKit 请输入 wss:// 地址"),
        apiKey: secret,
        apiSecret: secret,
        agentName: text.min(1),
      })
      .strict(),
    voice: z
      .object({
        apiKey: secret,
        useTextKey: z.boolean(),
        model: text.min(1),
        voice: text.min(1),
        transcriptionModel: text.min(1),
      })
      .strict(),
  })
  .strict();
export type APIConfig = z.infer<typeof configSchema>;
export type PublicConfig = {
  revision: number;
  config: APIConfig;
  secrets: Record<SecretField, boolean>;
};
export function defaultConfig(
  env: Record<string, string | undefined> = {},
): APIConfig {
  return {
    text: providerTextDefaults("openai"),
    tasks: {},
    firecrawl: {
      url: env.FIRECRAWL_API_URL || "",
      apiKey: env.FIRECRAWL_API_KEY || "",
    },
    video: { url: env.OPENMONTAGE_WORKER_URL || "" },
    moneyprinter: {
      url: env.MONEYPRINTERTURBO_URL || "",
      apiKey: env.MONEYPRINTERTURBO_API_KEY || "",
    },
    livekit: {
      url: env.LIVEKIT_URL || "",
      apiKey: env.LIVEKIT_API_KEY || "",
      apiSecret: env.LIVEKIT_API_SECRET || "",
      agentName: env.LIVEKIT_AGENT_NAME || "tradepilot-customer-service",
    },
    voice: {
      apiKey: env.OPENAI_API_KEY || "",
      useTextKey: false,
      model: env.OPENAI_REALTIME_MODEL || "gpt-realtime",
      voice: env.OPENAI_REALTIME_VOICE || "marin",
      transcriptionModel:
        env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    },
  };
}
export function textReady(config: APIConfig) {
  return Boolean(
    config.text.baseUrl &&
    config.text.model &&
    (config.text.apiKey || config.text.provider === "ollama"),
  );
}
export function voiceKey(config: APIConfig) {
  if (!config.voice.useTextKey) return config.voice.apiKey;
  // A custom gateway key is not necessarily an OpenAI Realtime credential.
  return config.text.provider === "openai" &&
    config.text.baseUrl.replace(/\/$/, "") === "https://api.openai.com/v1"
    ? config.text.apiKey
    : "";
}
export function redactConfig(
  config: APIConfig,
  revision: number,
): PublicConfig {
  const safe = structuredClone(config);
  const secrets = {} as Record<SecretField, boolean>;
  for (const field of SECRET_FIELDS) {
    const [section, key] = field.split(".");
    const object = safe[section as keyof APIConfig] as Record<string, unknown>;
    secrets[field] = Boolean(object[key]);
    object[key] = "";
  }
  return { config: safe, revision, secrets };
}
export function mergeSecrets(
  next: APIConfig,
  current: APIConfig,
  clear: readonly SecretField[],
) {
  const result = structuredClone(next);
  for (const field of SECRET_FIELDS) {
    const [section, key] = field.split(".");
    const target = result[section as keyof APIConfig] as Record<
      string,
      unknown
    >;
    const source = current[section as keyof APIConfig] as Record<
      string,
      unknown
    >;
    const destinationChanged =
      (section === "text" &&
        (next.text.provider !== current.text.provider ||
          next.text.baseUrl !== current.text.baseUrl ||
          next.text.requestPath !== current.text.requestPath)) ||
      (section === "livekit" && next.livekit.url !== current.livekit.url) ||
      (section === "firecrawl" &&
        next.firecrawl.url !== current.firecrawl.url) ||
      (section === "moneyprinter" &&
        next.moneyprinter.url !== current.moneyprinter.url);
    if (clear.includes(field)) target[key] = "";
    else if (!target[key] && !destinationChanged) target[key] = source[key];
  }
  return result;
}

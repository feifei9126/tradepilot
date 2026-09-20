/** Shared, browser-safe registry. Never put credentials in provider metadata. */
export const TEXT_PROVIDER_IDS = [
  "openai",
  "kimi",
  "doubao",
  "gemini",
  "zhipu",
  "deepseek",
  "tongyi",
  "openrouter",
  "siliconflow",
  "newapi",
  "ollama",
  "custom",
] as const;
export type TextProviderId = (typeof TEXT_PROVIDER_IDS)[number];

export const PROVIDER_GROUPS = {
  official: "官方模型服务",
  aggregator: "第三方聚合平台",
  custom: "本地与自定义",
} as const;

type ProviderPreset = {
  label: string;
  group: keyof typeof PROVIDER_GROUPS;
  baseUrl: string;
  model: string;
  modelHint: string;
  hint: string;
  docsUrl: string;
};

// New services deliberately require an account-visible model ID: model availability,
// region and endpoint permissions differ. Presets are not a promise of entitlement.
export const TEXT_PROVIDERS: Record<TextProviderId, ProviderPreset> = {
  openai: {
    label: "OpenAI（ChatGPT）",
    group: "official",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    modelHint: "填写支持 Chat Completions 的 OpenAI 模型 ID。",
    hint: "使用 OpenAI API 平台密钥，不是 ChatGPT 登录密码或订阅账号。此处接入文本 API，不是 ChatGPT 网页。",
    docsUrl: "https://platform.openai.com/docs/api-reference/chat",
  },
  kimi: {
    label: "Kimi（Moonshot / 月之暗面）",
    group: "official",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "",
    modelHint: "从 Moonshot 控制台复制模型 ID，不能填写聊天助手的显示名称。",
    hint: "默认使用国内站。国际站账号请按其控制台更改地址并使用对应密钥；Kimi 网页账号不能直接作为 API Key。",
    docsUrl: "https://platform.moonshot.cn/docs/intro",
  },
  doubao: {
    label: "豆包（火山方舟）",
    group: "official",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "",
    modelHint:
      "填写方舟已开通的模型 ID 或推理接入点 ep-…，不要填写「豆包」昵称。",
    hint: "使用火山方舟 API Key，而不是火山云 Access Key / Secret Key。区域、模型或接入点需与账号权限一致。",
    docsUrl: "https://www.volcengine.com/docs/82379/1494384",
  },
  gemini: {
    label: "Google Gemini",
    group: "official",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "",
    modelHint: "填写 Google AI Studio 可用的 Gemini 模型 ID。",
    hint: "使用 Gemini API 的 OpenAI 兼容接口和 AI Studio API Key；不是 Vertex AI 的服务账号凭据。请确认部署网络与账号区域可访问。",
    docsUrl: "https://ai.google.dev/gemini-api/docs/openai",
  },
  zhipu: {
    label: "智谱 GLM（BigModel）",
    group: "official",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "",
    modelHint: "填写智谱开放平台已授权的 GLM 模型 ID。",
    hint: "默认是国内通用 API。Coding 套餐专用端点或国际站凭据不能直接当作此端点的通用 API Key。",
    docsUrl: "https://docs.bigmodel.cn/cn/guide/develop/openai/introduction",
  },
  deepseek: {
    label: "DeepSeek",
    group: "official",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    modelHint: "填写 DeepSeek 控制台支持的模型 ID。预设名称可修改。",
    hint: "使用 DeepSeek 开放平台密钥；聊天网页账号与 API 凭据不同。",
    docsUrl: "https://api-docs.deepseek.com/",
  },
  tongyi: {
    label: "通义千问（阿里云百炼）",
    group: "official",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    modelHint: "填写百炼支持的 Qwen 模型 ID。",
    hint: "默认国内兼容端点；其他地域请按百炼控制台修改地址，密钥需与地域匹配。",
    docsUrl:
      "https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope",
  },
  openrouter: {
    label: "OpenRouter",
    group: "aggregator",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
    modelHint:
      "从平台模型列表复制完整 ID（通常为 厂商/模型），保留斜杠与后缀。",
    hint: "填写 OpenRouter 发放的 Key，而不是底层厂商 Key。同一入口可按任务选用平台支持的不同厂商模型。",
    docsUrl: "https://openrouter.ai/docs/quickstart",
  },
  siliconflow: {
    label: "硅基流动（SiliconFlow）",
    group: "aggregator",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "",
    modelHint: "复制平台完整模型 ID，包含组织名以及可能的 Pro/ 前缀。",
    hint: "使用硅基流动 API Key。默认国内站；国际站需按账号更改地址，不要混用不同站点密钥。",
    docsUrl: "https://docs.siliconflow.cn/cn/userguide/quickstart",
  },
  newapi: {
    label: "New API / One API 网关",
    group: "aggregator",
    baseUrl: "",
    model: "",
    modelHint: "填写网关令牌允许的模型名称或网关映射后的别名。",
    hint: "填写可信网关的 Base URL（通常以 /v1 结尾）及网关签发的令牌，不是后台登录密码。网关必须支持 OpenAI Chat Completions。",
    docsUrl: "https://docs.newapi.pro/api/openai-chat/",
  },
  ollama: {
    label: "Ollama（本地）",
    group: "custom",
    baseUrl: "http://host.docker.internal:11434/v1",
    model: "",
    modelHint: "填写已安装的完整模型名称，保留 :标签；保存后可读取模型列表。",
    hint: "Docker 访问 Mac 本机请使用 host.docker.internal，不要用 localhost。本地 Ollama 通常无需 API Key。",
    docsUrl: "https://docs.ollama.com/api/openai-compatibility",
  },
  custom: {
    label: "其他聚合 / 自定义 OpenAI 兼容 API",
    group: "custom",
    baseUrl: "",
    model: "",
    modelHint: "填写服务实际支持的模型 ID 或别名。",
    hint: "只支持 OpenAI Chat Completions 协议；不直接支持原生 Anthropic Messages、Gemini generateContent 或仅 Responses 的端点。可通过兼容网关转换。",
    docsUrl: "",
  },
};

/** A provider switch must not reuse another destination's credentials or model IDs. */
export function providerTextDefaults(provider: TextProviderId) {
  const preset = TEXT_PROVIDERS[provider];
  return {
    provider,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: "",
    customHeaders: "",
    requestPath: "/chat/completions",
  };
}

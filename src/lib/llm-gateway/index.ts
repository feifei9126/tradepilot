// ========================================
// LLM 网关 — 统一 AI 请求路由
// 功能：Provider 管理 + 模型路由 + 用量追踪
// ========================================

import { LLMProvider, LLMUsageRecord, AI_TASKS, AITaskConfig } from "./types";

// Provider 存储（实际环境应存入数据库）
let providers: LLMProvider[] = [];

export const llmGateway = {
  // ---- Provider 管理 ----
  listProviders: () => [...providers],

  getProvider: (id: string) => providers.find(p => p.id === id),

  addProvider: (p: LLMProvider) => { providers.push(p); return p; },

  updateProvider: (id: string, data: Partial<LLMProvider>) => {
    const idx = providers.findIndex(p => p.id === id);
    if (idx === -1) return null;
    providers[idx] = { ...providers[idx], ...data };
    return providers[idx];
  },

  deleteProvider: (id: string) => {
    const idx = providers.findIndex(p => p.id === id);
    if (idx >= 0) { providers.splice(idx, 1); return true; }
    return false;
  },

  // ---- 模型路由 ----
  getDefaultProvider: () => providers.find(p => p.isActive) || providers[0],

  // ---- 任务配置 ----
  taskConfigs: new Map<string, AITaskConfig>(),

  setTaskConfig(taskKey: string, config: Partial<AITaskConfig>) {
    const existing = this.taskConfigs.get(taskKey) || {
      taskKey, taskName: "", description: "", providerId: "", modelId: "",
      systemPrompt: "", temperature: 0.7, maxTokens: 2048, isActive: true,
    };
    this.taskConfigs.set(taskKey, { ...existing, ...config });
  },

  getTaskConfig(taskKey: string) { return this.taskConfigs.get(taskKey); },

  // ---- AI 请求路由 ----
  async chat(taskKey: string, messages: { role: string; content: string }[], options?: {
    providerId?: string; modelId?: string; temperature?: number; maxTokens?: number;
  }) {
    const taskConfig = this.taskConfigs.get(taskKey);
    const providerId = options?.providerId || taskConfig?.providerId || "deepseek";
    const provider = providers.find(p => p.id === providerId);
    if (!provider) throw new Error(`AI Provider "${providerId}" 未配置`);
    if (!provider.apiKeyEncrypted) throw new Error(`Provider "${providerId}" 未配置 API Key`);

    // 解密 API Key
    const { decryptApiKey } = await import("./crypto");
    const apiKey = await decryptApiKey(provider.apiKeyEncrypted!);

    const model = options?.modelId || taskConfig?.modelId || provider.defaultModel;
    const baseUrl = provider.baseUrl || "https://api.deepseek.com";
    const startTime = Date.now();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? taskConfig?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? taskConfig?.maxTokens ?? 2048,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `AI 请求失败: ${response.status}`);
    const durationMs = Date.now() - startTime;

    // 用量记录
    const usage: LLMUsageRecord = {
      id: `usage-${Date.now()}`, providerId, model, taskKey,
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
      estimatedCost: 0, durationMs, createdAt: new Date().toISOString(),
    };
    usageRecords.push(usage);

    return {
      content: data.choices?.[0]?.message?.content || "",
      model: data.model || model,
      usage,
    };
  },

  // ---- 用量统计 ----
  getUsage(options?: { taskKey?: string; days?: number }) {
    let records = [...usageRecords];
    if (options?.taskKey) records = records.filter(r => r.taskKey === options.taskKey);
    if (options?.days) {
      const cutoff = Date.now() - options.days * 86400000;
      records = records.filter(r => new Date(r.createdAt).getTime() > cutoff);
    }
    const totalTokens = records.reduce((s, r) => s + r.totalTokens, 0);
    return { records, totalTokens, count: records.length };
  },

  // ---- 测试连接 ----
  async testConnection(providerId: string) {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return { success: false, error: "Provider 不存在" };
    const { decryptApiKey } = await import("./crypto");
    try {
      const apiKey = await decryptApiKey(provider.apiKeyEncrypted!);
      const response = await fetch(`${provider.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

const usageRecords: LLMUsageRecord[] = [];

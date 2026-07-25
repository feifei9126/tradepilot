"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "tradepilot_ai_config";

export type AIProviderConfig = {
  apiKey: string;
  baseUrl: string;
  requestPath: string;
  model: string;
  userAgent: string;
  customHeaders: string;
  useProxy: boolean;
  proxyUrl: string;
};

export interface AIConfig {
  providers: Record<string, AIProviderConfig>;
  taskMapping: Record<string, string>;
}

const DEFAULT_CONFIG: AIConfig = {
  providers: {},
  taskMapping: {},
};

export const DEFAULT_PROVIDER_SETTINGS: Record<
  string,
  Omit<AIProviderConfig, "apiKey" | "model"> & { model: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    requestPath: "/chat/completions",
    model: "gpt-4o-mini",
    userAgent: "TradePilot/0.1",
    customHeaders: "",
    useProxy: false,
    proxyUrl: "",
  },
  tongyi: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    requestPath: "/chat/completions",
    model: "qwen-plus",
    userAgent: "TradePilot/0.1",
    customHeaders: "",
    useProxy: false,
    proxyUrl: "",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    requestPath: "/chat/completions",
    model: "deepseek-chat",
    userAgent: "TradePilot/0.1",
    customHeaders: "",
    useProxy: false,
    proxyUrl: "",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    requestPath: "/chat/completions",
    model: "",
    userAgent: "TradePilot/0.1",
    customHeaders: "",
    useProxy: false,
    proxyUrl: "",
  },
};

export function getDefaultProviderConfig(providerId: string): AIProviderConfig {
  const defaults =
    DEFAULT_PROVIDER_SETTINGS[providerId] || DEFAULT_PROVIDER_SETTINGS.deepseek;
  return {
    apiKey: "",
    ...defaults,
  };
}

function normalizeProviderConfig(
  providerId: string,
  data: Partial<AIProviderConfig>,
): AIProviderConfig {
  const defaults = getDefaultProviderConfig(providerId);
  return {
    ...defaults,
    ...data,
    baseUrl: data.baseUrl || defaults.baseUrl,
    requestPath: data.requestPath || defaults.requestPath,
    model: data.model ?? defaults.model,
    userAgent: data.userAgent ?? defaults.userAgent,
    customHeaders: data.customHeaders ?? defaults.customHeaders,
    useProxy: data.useProxy ?? defaults.useProxy,
    proxyUrl: data.proxyUrl ?? defaults.proxyUrl,
  };
}

function normalizeConfig(value: unknown): AIConfig {
  const parsed =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<AIConfig>)
      : {};
  const providers: AIConfig["providers"] = {};
  const rawProviders =
    parsed.providers &&
    typeof parsed.providers === "object" &&
    !Array.isArray(parsed.providers)
      ? parsed.providers
      : {};
  Object.entries(rawProviders).forEach(([providerId, provider]) => {
    if (!provider || typeof provider !== "object" || Array.isArray(provider))
      return;
    providers[providerId] = normalizeProviderConfig(
      providerId,
      provider as Partial<AIProviderConfig>,
    );
  });
  const rawTaskMapping =
    parsed.taskMapping &&
    typeof parsed.taskMapping === "object" &&
    !Array.isArray(parsed.taskMapping)
      ? parsed.taskMapping
      : {};
  const taskMapping = Object.fromEntries(
    Object.entries(rawTaskMapping).filter(
      ([, mapping]) =>
        typeof mapping === "string" && parseTaskMapping(mapping) !== null,
    ),
  ) as Record<string, string>;
  return {
    providers,
    taskMapping,
  };
}

export function parseTaskMapping(mapping: string) {
  const separator = mapping.indexOf(":");
  if (separator <= 0 || separator === mapping.length - 1) return null;
  return {
    providerId: mapping.slice(0, separator),
    model: mapping.slice(separator + 1),
  };
}

export function useAIConfig() {
  const [config, setConfigState] = useState<AIConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setConfigState(normalizeConfig(JSON.parse(saved)));
        }
      } catch (e) {
        console.warn("Failed to load AI config:", e);
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setConfig = useCallback(
    (value: AIConfig | ((prev: AIConfig) => AIConfig)) => {
      if (typeof value === "function") {
        setConfigState((prev) => {
          const result = (value as (prev: AIConfig) => AIConfig)(prev);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
          } catch {}
          return result;
        });
      } else {
        setConfigState(value);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        } catch {}
      }
    },
    [],
  );

  const updateProvider = useCallback(
    (providerId: string, data: Partial<AIProviderConfig>) => {
      setConfig((prev) => ({
        ...prev,
        providers: {
          ...prev.providers,
          [providerId]: normalizeProviderConfig(providerId, {
            ...prev.providers[providerId],
            ...data,
          }),
        },
      }));
    },
    [setConfig],
  );

  const removeProvider = useCallback(
    (providerId: string) => {
      setConfig((prev) => {
        const providers = { ...prev.providers };
        delete providers[providerId];
        const taskMapping = { ...prev.taskMapping };
        for (const [task, value] of Object.entries(taskMapping)) {
          if (value.startsWith(providerId + ":")) {
            delete taskMapping[task];
          }
        }
        return { ...prev, providers, taskMapping };
      });
    },
    [setConfig],
  );

  const updateTaskMapping = useCallback(
    (taskKey: string, value: string) => {
      setConfig((prev) => ({
        ...prev,
        taskMapping: { ...prev.taskMapping, [taskKey]: value },
      }));
    },
    [setConfig],
  );

  const getTaskProvider = useCallback(
    (taskKey: string) => {
      const mapping = config.taskMapping[taskKey];
      if (!mapping) return null;
      const parsed = parseTaskMapping(mapping);
      if (!parsed) return null;
      const provider = config.providers[parsed.providerId];
      if (!provider) return null;
      return { ...provider, ...parsed };
    },
    [config],
  );

  return {
    config,
    loaded,
    setConfig,
    updateProvider,
    removeProvider,
    updateTaskMapping,
    getTaskProvider,
  };
}

"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "tradepilot_ai_config";

export interface AIConfig {
  providers: Record<string, { apiKey: string; baseUrl?: string; model: string }>;
  taskMapping: Record<string, string>;
}

const DEFAULT_CONFIG: AIConfig = {
  providers: {},
  taskMapping: {},
};

export function useAIConfig() {
  const [config, setConfigState] = useState<AIConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount; auto-configure DeepSeek on first visit
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setConfigState(JSON.parse(saved));
      } else {
        // Auto-configure DeepSeek so AI features work out of the box
        const defaultConfig: AIConfig = {
          providers: {
            deepseek: { apiKey: "sk-9cf7295494dd4f8cb59d5700b753e0b4", model: "deepseek-chat" },
          },
          taskMapping: {
            quotation: "deepseek:deepseek-chat",
            order_suggestion: "deepseek:deepseek-chat",
            inquiry_extraction: "deepseek:deepseek-chat",
            customer_analysis: "deepseek:deepseek-chat",
            communication_summary: "deepseek:deepseek-chat",
            document_generation: "deepseek:deepseek-chat",
            embedding: "deepseek:deepseek-chat",
          },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultConfig));
        setConfigState(defaultConfig);
      }
    } catch (e) {
      console.warn("Failed to load AI config:", e);
    }
    setLoaded(true);
  }, []);

  const setConfig = useCallback((value: AIConfig | ((prev: AIConfig) => AIConfig)) => {
    if (typeof value === "function") {
      setConfigState((prev) => {
        const result = (value as (prev: AIConfig) => AIConfig)(prev);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)); } catch {}
        return result;
      });
    } else {
      setConfigState(value);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch {}
    }
  }, []);

  const updateProvider = useCallback(
    (providerId: string, data: { apiKey: string; baseUrl?: string; model: string }) => {
      setConfig((prev) => ({
        ...prev,
        providers: { ...prev.providers, [providerId]: data },
      }));
    },
    [setConfig]
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
    [setConfig]
  );

  const updateTaskMapping = useCallback(
    (taskKey: string, value: string) => {
      setConfig((prev) => ({
        ...prev,
        taskMapping: { ...prev.taskMapping, [taskKey]: value },
      }));
    },
    [setConfig]
  );

  const getTaskProvider = useCallback(
    (taskKey: string) => {
      const mapping = config.taskMapping[taskKey];
      if (!mapping) return null;
      const [providerId, model] = mapping.split(":");
      const provider = config.providers[providerId];
      if (!provider) return null;
      return { providerId, model, apiKey: provider.apiKey, baseUrl: provider.baseUrl };
    },
    [config]
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

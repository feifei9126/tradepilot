"use client";
import { useCallback, useEffect, useState } from "react";
import { AI_TASKS } from "@/lib/api-config/schema";

// Only readiness and task names are needed by feature pages. Secrets remain server-side.
export function useAIConfig() {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [scope, setScope] = useState<"tenant" | "platform">("tenant");
  const [unavailableReason, setUnavailableReason] = useState("请联系工作区管理员在「AI 用量」配置并启用 AI");
  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetch("/api/api-config/status", { cache: "no-store" })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (active) {
            setReady(Boolean(data?.textReady));
            setScope(data?.scope === "platform" ? "platform" : "tenant");
            setUnavailableReason(data?.unavailableReason || data?.error || "AI 配置状态不可用，请刷新后重试");
            setLoaded(true);
          }
        })
        .catch(() => {
          if (active) {
            setReady(false);
            setUnavailableReason("AI 配置状态不可用，请刷新后重试");
            setLoaded(true);
          }
        });
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("tradepilot-api-config", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("tradepilot-api-config", refresh);
    };
  }, []);
  const getTaskProvider = useCallback(
    (task: string) =>
      ready && Object.hasOwn(AI_TASKS, task) ? { task } : null,
    [ready],
  );
  return { loaded, ready, getTaskProvider, scope, unavailableReason,
    configurationUrl: scope === "platform" ? "/app/api-config" : "/app/ai-usage" };
}

// Kept for explicit migration of browser-era task mappings.
export function parseTaskMapping(value: string) {
  const colon = value.indexOf(":");
  if (colon < 1 || colon === value.length - 1) return null;
  return { providerId: value.slice(0, colon), model: value.slice(colon + 1) };
}

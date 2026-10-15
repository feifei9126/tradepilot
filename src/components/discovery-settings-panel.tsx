"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Settings = {
  hasApiKey: boolean;
  enabled: boolean;
  dailyRequestLimit: number;
  platformDailyLimit: number;
  requestsToday: number;
  canManage: boolean;
};
export function DiscoverySettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/tenant/discovery-settings", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "获客配置读取失败");
    setSettings(data);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch((e) => toast.error(e.message));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function save(enabled: boolean, clearApiKey = false) {
    if (!settings) return;
    setBusy(true);
    try {
      const response = await fetch("/api/tenant/discovery-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          enabled,
          clearApiKey,
          dailyRequestLimit: settings.dailyRequestLimit,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      setApiKey("");
      await load();
      toast.success("本工作区获客配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card id="discovery-settings" className="discovery-connection">
      <CardHeader>
        <CardTitle>接通获客搜索</CardTitle>
        <CardDescription>
          填写本工作区的 Firecrawl Cloud Key，搜索和产品抓取共用日预算。AI
          联系话术另外使用「AI 用量」中的模型。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <details className="connection-help">
          <summary>配置说明与额度规则</summary>
          <ol className="list-inside list-decimal space-y-2 text-xs leading-6">
            <li>
              在 Firecrawl Cloud 注册并复制 API
              Key。搜索服务可能收费，使用前请确认余额。
            </li>
            <li>
              由本工作区所有者或管理员填写 Key 和每日预算，保存并启用。留空 Key
              会保留已经保存的密钥。
            </li>
            <li>
              搜索前预留一次额度，失败也计次；平台管理员的产品抓取使用相同预算。
            </li>
            <li>
              按 UTC
              自然日统计；实际可用上限取工作区预算与平台安全上限的较小值，每项任务至少间隔
              15 分钟。
            </li>
          </ol>
        </details>
        {settings ? (
          <>
            <div className="connection-status">
              <span
                className={
                  settings.enabled && settings.hasApiKey
                    ? "connection-enabled"
                    : "connection-disabled"
                }
              >
                {settings.enabled && settings.hasApiKey ? "已启用" : "未启用"}
              </span>
              <span>
                今日已请求 <strong>{settings.requestsToday}</strong> 次
              </span>
              <span>平台上限 {settings.platformDailyLimit} 次 / 天</span>
            </div>
            {settings.canManage ? (
              <div className="space-y-4">
                <div className="connection-fields">
                  <div className="space-y-2">
                    <Label htmlFor="discovery-key">
                      Firecrawl Cloud API Key{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {settings.hasApiKey ? "已保存，不回显" : "未配置"}
                      </span>
                    </Label>
                    <Input
                      id="discovery-key"
                      type="password"
                      autoComplete="new-password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={
                        settings.hasApiKey
                          ? "留空保留原密钥"
                          : "填写本工作区的 Key"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discovery-budget">每日请求上限</Label>
                    <Input
                      id="discovery-budget"
                      type="number"
                      min={1}
                      max={1000}
                      value={settings.dailyRequestLimit}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          dailyRequestLimit: Number(event.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void save(true)}>
                    保存并启用
                  </Button>
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => void save(false)}
                  >
                    暂停搜索
                  </Button>
                  <Button
                    disabled={busy || !settings.hasApiKey}
                    variant="ghost"
                    onClick={() => void save(false, true)}
                  >
                    移除 Key
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                请联系工作区所有者或管理员配置
                Key。普通成员可查看用量并使用已经启用的服务。
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            正在读取配置…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import {
  Check,
  Plus,
  X,
  Globe,
  Loader2,
  Languages,
  Bot,
  Cpu,
  Shield,
  RefreshCw,
  Copy,
  Download,
  ExternalLink,
  Terminal,
  Network,
  Route,
  type LucideIcon,
} from "lucide-react";
import {
  getDefaultProviderConfig,
  useAIConfig,
  type AIProviderConfig,
} from "@/hooks/useAIConfig";
import CustomFieldsTab from "@/components/custom-fields/settings-tab";
import { OLLAMA_RECOMMENDED_MODELS } from "@/lib/ollama/recommended-models";

import { useTranslation, type Locale } from "@/lib/i18n";

type ProviderOption = {
  id: "openai" | "tongyi" | "deepseek" | "ollama";
  name: string;
  models: string[];
  docs: string;
  icon: LucideIcon;
  hasBaseUrl?: boolean;
  noApiKey?: boolean;
};

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini"],
    docs: "https://platform.openai.com/api-keys",
    icon: Cpu,
  },
  {
    id: "tongyi",
    name: "通义千问",
    models: ["qwen-max", "qwen-plus"],
    docs: "https://help.aliyun.com/zh/model-studio/",
    icon: Globe,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
    docs: "https://platform.deepseek.com/",
    icon: Bot,
  },
  {
    id: "ollama",
    name: "Ollama（本地）",
    models: [],
    docs: "https://ollama.com",
    icon: Cpu,
    hasBaseUrl: true,
    noApiKey: true,
  },
];

const TASK_OPTIONS: { key: string; label: string }[] = [
  { key: "email_compose", label: "邮件草稿" },
  { key: "inquiry_reply", label: "询盘回复草稿" },
  { key: "message_reply", label: "消息回复草稿" },
  { key: "product_enrichment", label: "产品资料补全" },
  { key: "quotation", label: "报价生成" },
  { key: "order_suggestion", label: "跟单建议" },
  { key: "customer_analysis", label: "客户分析" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function getEffectiveEndpoint(provider: AIProviderConfig) {
  if (provider.useProxy && provider.proxyUrl.trim())
    return provider.proxyUrl.trim();
  const baseUrl = (provider.baseUrl || "").replace(/\/$/, "");
  const requestPath = provider.requestPath?.startsWith("/")
    ? provider.requestPath
    : `/${provider.requestPath || "chat/completions"}`;
  return `${baseUrl}${requestPath}`;
}

function getOllamaServiceUrl(provider?: AIProviderConfig) {
  const baseUrl = provider?.baseUrl || "http://localhost:11434/v1";
  return baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");
}

export default function SettingsPage() {
  const { config, loaded, updateProvider, removeProvider, updateTaskMapping } =
    useAIConfig();
  const { locale, setLocale } = useTranslation();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("ai");
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<
    { name: string; sizeLabel: string }[]
  >([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [deployingModel, setDeployingModel] = useState<string | null>(null);

  async function handleTest(providerId: string) {
    const p = config.providers[providerId];

    // Ollama without a selected model: only test the local daemon health.
    if (providerId === "ollama" && !p?.model) {
      setTestingId(providerId);
      try {
        const baseUrl = getOllamaServiceUrl(p);
        const res = await fetch(
          `/api/ollama/test?baseUrl=${encodeURIComponent(baseUrl)}`,
        );
        const data = await res.json();
        if (data.ok)
          toast.success(`Ollama 连接成功 — ${data.modelCount} 个模型`);
        else
          toast.error(
            `连接失败: ${data.error || "未知错误"}，请先启动 Ollama 或检查服务地址`,
          );
      } catch (error: unknown) {
        toast.error(getErrorMessage(error));
      } finally {
        setTestingId(null);
      }
      return;
    }

    if (!p?.apiKey && providerId !== "ollama") {
      toast.error("请先输入 API Key");
      return;
    }
    setTestingId(providerId);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: p.apiKey,
          provider: providerId,
          model: p.model,
          baseUrl: p.baseUrl,
          requestPath: p.requestPath,
          userAgent: p.userAgent,
          customHeaders: p.customHeaders,
          useProxy: p.useProxy,
          proxyUrl: p.proxyUrl,
          messages: [{ role: "user", content: "Respond with just: OK" }],
          maxTokens: 10,
        }),
      });
      const data = await res.json();
      if (res.ok) toast.success(`${providerId} 连接成功`);
      else toast.error(`${data.error || "连接失败"}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setTestingId(null);
    }
  }

  async function handleRefreshOllamaModels() {
    const p = config.providers.ollama;
    const baseUrl = getOllamaServiceUrl(p);
    setOllamaLoading(true);
    try {
      const res = await fetch(
        `/api/ollama/models?baseUrl=${encodeURIComponent(baseUrl)}`,
      );
      const data = await res.json();
      if (data.ok) {
        setOllamaModels(data.models);
        toast.success(`发现 ${data.models.length} 个本地模型`);
        if (data.models.length > 0 && p && !p.model) {
          updateProvider("ollama", {
            apiKey: "",
            model: data.models[0].name,
            baseUrl,
          });
        }
      } else {
        toast.error(data.error || "获取失败");
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setOllamaLoading(false);
    }
  }

  async function handleCopyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      toast.success("安装口令已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  async function handleDeployOllamaModel(modelName: string) {
    const p = config.providers.ollama;
    const baseUrl = getOllamaServiceUrl(p);
    setDeployingModel(modelName);
    try {
      const res = await fetch("/api/ollama/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName, baseUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "部署失败");
        return;
      }
      updateProvider("ollama", { apiKey: "", model: modelName });
      toast.success(`${data.label || modelName} 部署完成`);
      await handleRefreshOllamaModels();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeployingModel(null);
    }
  }

  function addProvider(id: string) {
    if (config.providers[id]) {
      setActiveProviderId(id);
      return;
    }
    const opt = PROVIDER_OPTIONS.find((p) => p.id === id);
    if (!opt) return;
    if (id === "ollama") {
      updateProvider(id, getDefaultProviderConfig(id));
    } else {
      updateProvider(id, {
        ...getDefaultProviderConfig(id),
        model: opt.models[0] || "",
      });
    }
    setActiveProviderId(id);
  }

  function handleRemoveProvider(id: string) {
    removeProvider(id);
    setActiveProviderId((current) => (current === id ? null : current));
  }

  function getModelOptions() {
    const opts: { value: string; label: string }[] = [];
    Object.entries(config.providers).forEach(([pid, pcfg]) => {
      const optDef = PROVIDER_OPTIONS.find((o) => o.id === pid);
      if (pid === "ollama") {
        const models =
          ollamaModels.length > 0
            ? ollamaModels.map((m) => m.name)
            : pcfg.model
              ? [pcfg.model]
              : [];
        models.forEach((m) =>
          opts.push({ value: `${pid}:${m}`, label: `Ollama / ${m}` }),
        );
        return;
      }
      if (!pcfg.apiKey) return;
      const models = pcfg.model ? [pcfg.model] : optDef?.models || [];
      models.forEach((m) =>
        opts.push({
          value: `${pid}:${m}`,
          label: `${optDef?.name || pid} / ${m}`,
        }),
      );
    });
    return opts;
  }

  if (!loaded)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );
  const modelOptions = getModelOptions();
  const configuredEntries = Object.entries(config.providers);
  const activeConfiguredEntries = activeProviderId
    ? configuredEntries.filter(([id]) => id === activeProviderId)
    : configuredEntries;
  const visibleConfiguredEntries =
    activeConfiguredEntries.length > 0
      ? activeConfiguredEntries
      : configuredEntries;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="page-kicker">SYSTEM / CONFIGURATION</p>
          <h1>设置与集成</h1>
          <p className="page-description">管理 AI 提供商和系统配置</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <Select
              value={locale}
              items={{ zh: "中文", en: "English" }}
              onValueChange={(v) => v && setLocale(v as Locale)}
            >
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-muted/55 p-1">
        {[
          { id: "ai", label: "AI 提供商" },
          { id: "tasks", label: "任务映射" },
          { id: "custom-fields", label: "自定义字段" },
          { id: "system", label: "系统设置" },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeSection === tab.id ? "default" : "ghost"}
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={() => setActiveSection(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="flex min-w-0 gap-5">
        <div className="min-w-0 flex-1 space-y-4">
          {activeSection === "ai" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">AI 模型提供商</CardTitle>
                <p className="text-sm text-muted-foreground">
                  配置 AI API Key，仅保存在浏览器本地
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {PROVIDER_OPTIONS.map((opt) => {
                  const isAdded = !!config.providers[opt.id];
                  const Icon = opt.icon;
                  return (
                    <div
                      key={opt.id}
                      className="flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{opt.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {opt.id === "ollama"
                              ? "本地部署，无需 API Key"
                              : `需提供 ${opt.name} API Key`}
                          </p>
                        </div>
                      </div>
                      {!isAdded ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => addProvider(opt.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> 添加并配置
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="h-5 text-xs">
                            已添加
                          </Badge>
                          <Button
                            size="sm"
                            variant={
                              activeProviderId === opt.id
                                ? "default"
                                : "outline"
                            }
                            className="h-7 text-xs"
                            onClick={() => setActiveProviderId(opt.id)}
                          >
                            配置
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveProvider(opt.id)}
                            aria-label={`移除 ${opt.name}`}
                            title={`移除 ${opt.name}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {activeSection === "ai" && configuredEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">提供商配置</CardTitle>
                <p className="text-sm text-muted-foreground">
                  在这里填写完整 API
                  Key、模型和本地服务地址；上方点击“配置”可切换提供商。
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleConfiguredEntries.map(([id, pcfg]) => {
                  const opt = PROVIDER_OPTIONS.find((o) => o.id === id);
                  if (!opt) return null;
                  const Icon = opt.icon;
                  const isOllama = opt.noApiKey === true;
                  return (
                    <div key={id} className="rounded-md border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">
                            {opt.name}
                          </span>
                          {isOllama && (
                            <Badge
                              variant="outline"
                              className="h-5 text-xs border-green-300 text-green-700"
                            >
                              本地
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleTest(id)}
                            disabled={testingId === id}
                          >
                            {testingId === id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Check className="h-3 w-3 mr-1" />
                            )}
                            测试连接
                          </Button>
                        </div>
                      </div>

                      {!isOllama && (
                        <div>
                          <Label className="text-xs">API Key</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="password"
                              value={pcfg.apiKey}
                              onChange={(e) =>
                                updateProvider(id, {
                                  ...pcfg,
                                  apiKey: e.target.value,
                                })
                              }
                              placeholder="sk-..."
                              className="h-8 text-xs font-mono"
                            />
                            <a
                              href={opt.docs}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary shrink-0 whitespace-nowrap"
                            >
                              获取 Key ↗
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Network className="h-4 w-4 text-primary" />
                            <div>
                              <p className="text-sm font-medium">
                                API 请求配置
                              </p>
                              <p className="text-xs text-muted-foreground">
                                配置真实请求地址；开启代理后会用代理地址完全覆盖。
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() =>
                              updateProvider(id, {
                                ...pcfg,
                                ...getDefaultProviderConfig(id),
                                apiKey: pcfg.apiKey,
                              })
                            }
                          >
                            恢复默认
                          </Button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                          <div>
                            <Label className="text-xs">
                              API 请求地址 Base URL
                            </Label>
                            <Input
                              value={pcfg.baseUrl || ""}
                              onChange={(e) =>
                                updateProvider(id, {
                                  ...pcfg,
                                  baseUrl: e.target.value,
                                })
                              }
                              placeholder={
                                isOllama
                                  ? "http://localhost:11434/v1"
                                  : "https://api.example.com/v1"
                              }
                              className="mt-1 h-8 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">请求路径</Label>
                            <Input
                              value={pcfg.requestPath || ""}
                              onChange={(e) =>
                                updateProvider(id, {
                                  ...pcfg,
                                  requestPath: e.target.value,
                                })
                              }
                              placeholder="/chat/completions"
                              className="mt-1 h-8 text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                          <div>
                            <Label className="text-xs">自定义 User-Agent</Label>
                            <Input
                              value={pcfg.userAgent || ""}
                              onChange={(e) =>
                                updateProvider(id, {
                                  ...pcfg,
                                  userAgent: e.target.value,
                                })
                              }
                              placeholder="TradePilot/0.1"
                              className="mt-1 h-8 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">本地代理请求覆盖</Label>
                            <div className="mt-1 flex items-center gap-2">
                              <label className="flex h-8 shrink-0 items-center gap-2 rounded-md border px-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={pcfg.useProxy}
                                  onChange={(e) =>
                                    updateProvider(id, {
                                      ...pcfg,
                                      useProxy: e.target.checked,
                                    })
                                  }
                                  className="h-3.5 w-3.5"
                                />
                                启用
                              </label>
                              <Input
                                value={pcfg.proxyUrl || ""}
                                onChange={(e) =>
                                  updateProvider(id, {
                                    ...pcfg,
                                    proxyUrl: e.target.value,
                                  })
                                }
                                disabled={!pcfg.useProxy}
                                placeholder="http://127.0.0.1:7890/v1/chat/completions"
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">
                            自定义 Headers(JSON，可选)
                          </Label>
                          <Textarea
                            value={pcfg.customHeaders || ""}
                            onChange={(e) =>
                              updateProvider(id, {
                                ...pcfg,
                                customHeaders: e.target.value,
                              })
                            }
                            placeholder={
                              '例如: {"HTTP-Referer":"http://localhost:3458","X-Title":"TradePilot"}'
                            }
                            className="mt-1 min-h-16 resize-y text-xs font-mono"
                          />
                        </div>

                        <div className="flex min-w-0 items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs text-muted-foreground">
                          <Route className="h-3.5 w-3.5 shrink-0" />
                          <span className="shrink-0">最终请求地址</span>
                          <span className="truncate font-mono">
                            {getEffectiveEndpoint(pcfg)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-xs">模型</Label>
                          {isOllama ? (
                            <Select
                              value={pcfg.model}
                              onValueChange={(v) =>
                                v && updateProvider(id, { ...pcfg, model: v })
                              }
                            >
                              <SelectTrigger className="w-full h-8 text-xs mt-1">
                                <SelectValue
                                  placeholder={
                                    ollamaModels.length > 0
                                      ? "选择模型..."
                                      : "输入模型名..."
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {ollamaModels.map((m) => (
                                  <SelectItem key={m.name} value={m.name}>
                                    {m.name} ({m.sizeLabel})
                                  </SelectItem>
                                ))}
                                {ollamaModels.length === 0 && pcfg.model && (
                                  <SelectItem value={pcfg.model}>
                                    {pcfg.model}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Select
                              value={pcfg.model}
                              onValueChange={(v) =>
                                v && updateProvider(id, { ...pcfg, model: v })
                              }
                            >
                              <SelectTrigger className="w-full h-8 text-xs mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {opt.models.map((m) => (
                                  <SelectItem key={m} value={m}>
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        {isOllama && (
                          <div className="pt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs shrink-0"
                              onClick={handleRefreshOllamaModels}
                              disabled={ollamaLoading}
                            >
                              <RefreshCw
                                className={
                                  ollamaLoading
                                    ? "h-3 w-3 animate-spin mr-1"
                                    : "h-3 w-3 mr-1"
                                }
                              />
                              刷新列表
                            </Button>
                          </div>
                        )}
                      </div>

                      {isOllama && (
                        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <Label className="text-xs">
                                推荐模型一键部署
                              </Label>
                              <p className="mt-1 text-xs text-muted-foreground">
                                点击部署会调用 Ollama
                                本地服务下载模型，也可复制安装口令到终端执行。
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="hidden h-5 text-xs sm:inline-flex"
                            >
                              /api/pull
                            </Badge>
                          </div>
                          <div className="grid gap-2">
                            {OLLAMA_RECOMMENDED_MODELS.map((model) => {
                              const selected = pcfg.model === model.name;
                              const deploying = deployingModel === model.name;
                              return (
                                <div
                                  key={model.name}
                                  className="rounded-md border bg-background p-3"
                                >
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium">
                                          {model.label}
                                        </span>
                                        <Badge
                                          variant={
                                            selected ? "default" : "secondary"
                                          }
                                          className="h-5 text-xs"
                                        >
                                          {model.name}
                                        </Badge>
                                        <Badge
                                          variant="outline"
                                          className="h-5 text-xs"
                                        >
                                          {model.sizeLabel}
                                        </Badge>
                                      </div>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {model.bestFor}
                                      </p>
                                      <div className="mt-2 flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                                        <Terminal className="h-3 w-3 shrink-0" />
                                        <span className="truncate">
                                          {model.installCommand}
                                        </span>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                                        <a
                                          href={model.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          开源地址
                                        </a>
                                        <a
                                          href={model.ollamaUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Ollama 模型页
                                        </a>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                          selected ? "secondary" : "outline"
                                        }
                                        className="h-8 text-xs"
                                        onClick={() =>
                                          updateProvider(id, {
                                            ...pcfg,
                                            model: model.name,
                                          })
                                        }
                                      >
                                        <Check className="h-3.5 w-3.5 mr-1" />
                                        {selected ? "已选用" : "选用"}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                          handleDeployOllamaModel(model.name)
                                        }
                                        disabled={deployingModel !== null}
                                      >
                                        {deploying ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                        ) : (
                                          <Download className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        一键部署
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                          handleCopyCommand(
                                            model.installCommand,
                                          )
                                        }
                                      >
                                        <Copy className="h-3.5 w-3.5 mr-1" />
                                        复制口令
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div>
                            <Label className="text-xs">
                              或手动输入模型名称
                            </Label>
                            <Input
                              value={pcfg.model || ""}
                              onChange={(e) =>
                                updateProvider(id, {
                                  ...pcfg,
                                  model: e.target.value,
                                })
                              }
                              placeholder="例如: phi4-mini:3.8b"
                              className="mt-1 h-8 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {activeSection === "tasks" && modelOptions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">任务与模型映射</CardTitle>
                <p className="text-sm text-muted-foreground">
                  为每个任务指定使用的 AI 模型
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {TASK_OPTIONS.map((task) => (
                  <div
                    key={task.key}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{task.label}</span>
                    <Select
                      value={config.taskMapping[task.key] || ""}
                      items={modelOptions}
                      onValueChange={(v) => v && updateTaskMapping(task.key, v)}
                    >
                      <SelectTrigger className="w-56 h-8 text-xs">
                        <SelectValue placeholder="选择模型..." />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeSection === "system" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">当前运行模式</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">业务数据</p>
                      <p className="text-xs text-muted-foreground">
                        客户、订单、询盘等由进程内存保存，服务重启后恢复种子数据。
                      </p>
                    </div>
                    <Badge variant="secondary">演示模式</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">身份认证</p>
                      <p className="text-xs text-muted-foreground">
                        当前只启用部署时提供的演示账号，尚未接入用户数据库。
                      </p>
                    </div>
                    <Badge variant="secondary">单用户</Badge>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    默认货币和贸易术语尚未接入统一配置模型，因此已移除原先不会保存的控件。生产使用前应先接入持久数据库和租户级设置。
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-4 flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">隐私说明</p>
                    <p className="text-xs mt-0.5">
                      API Key 仅持久化在当前浏览器，调用时会发送到 TradePilot
                      服务端，再由服务端请求你配置的模型地址。Ollama
                      可完全在本机运行。
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "custom-fields" && <CustomFieldsTab />}

          {activeSection === "tasks" && modelOptions.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                <Cpu className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>暂无可用模型</p>
                <p className="text-xs mt-1">
                  请先在「AI 提供商」中添加并配置 API Key
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

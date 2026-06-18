"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Check, Plus, X, Key, Globe, Loader2, Languages, Bot, Cpu, Shield, RefreshCw, Eye } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";
import CustomFieldsTab from "@/components/custom-fields/settings-tab";

import { useTranslation, type Locale } from "@/lib/i18n";

const PROVIDER_OPTIONS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini"], docs: "https://platform.openai.com/api-keys", icon: Cpu },
  { id: "tongyi", name: "通义千问", models: ["qwen-max", "qwen-plus"], docs: "https://help.aliyun.com/zh/model-studio/" },
  { id: "deepseek", name: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"], docs: "https://platform.deepseek.com/" },
  { id: "ollama", name: "Ollama（本地）", models: ["llama3.1", "qwen2.5"], docs: "https://ollama.ai", hasBaseUrl: true },
];

const TASK_OPTIONS: { key: string; label: string }[] = [
  { key: "quotation", label: "报价生成" },
  { key: "inquiry_extraction", label: "询盘提取" },
  { key: "order_suggestion", label: "跟单建议" },
  { key: "communication_summary", label: "沟通摘要" },
  { key: "document_generation", label: "单证生成" },
  { key: "customer_analysis", label: "客户分析" },
  { key: "embedding", label: "向量 Embedding" },
];

export default function SettingsPage() {
  const { config, loaded, updateProvider, removeProvider, updateTaskMapping, setConfig } = useAIConfig();
  const { t, locale, setLocale } = useTranslation();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("ai");

  useEffect(() => {
    if (loaded && !config.providers.deepseek) {
      const key = "sk-9cf7295494dd4f8cb59d5700b753e0b4";
      const mappings: Record<string, string> = {};
      TASK_OPTIONS.forEach(t => { mappings[t.key] = "deepseek:deepseek-chat"; });
      setConfig({ providers: { deepseek: { apiKey: key, model: "deepseek-chat" } }, taskMapping: mappings });
    }
  }, [loaded]);

  async function handleTest(providerId: string) {
    const p = config.providers[providerId];
    if (!p?.apiKey) { toast.error("请先输入 API Key"); return; }
    setTestingId(providerId);
    try {
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: p.apiKey, provider: providerId, model: p.model, messages: [{ role: "user", content: "Respond with just: OK" }], maxTokens: 10 }),
      });
      const data = await res.json();
      if (res.ok) toast.success(`${providerId} 连接成功`);
      else toast.error(`${data.error || "连接失败"}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setTestingId(null); }
  }

  function addProvider(id: string) {
    if (config.providers[id]) return;
    const opt = PROVIDER_OPTIONS.find(p => p.id === id);
    if (!opt) return;
    updateProvider(id, { apiKey: "", model: opt.models[0], baseUrl: id === "ollama" ? "http://localhost:11434" : undefined });
  }

  function getModelOptions() {
    const opts: { value: string; label: string }[] = [];
    Object.entries(config.providers).forEach(([pid, pcfg]) => {
      const optDef = PROVIDER_OPTIONS.find(o => o.id === pid);
      if (!pcfg.apiKey) return;
      const models = pcfg.model ? [pcfg.model] : (optDef?.models || []);
      models.forEach(m => opts.push({ value: `${pid}:${m}`, label: `${optDef?.name || pid} / ${m}` }));
    });
    return opts;
  }

  if (!loaded) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  const modelOptions = getModelOptions();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">设置</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理 AI 提供商和系统配置</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <Select value={locale} onValueChange={(v) => v && setLocale(v as Locale)}>
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {/* Left: Navigation */}
        <div className="space-y-1">
          <button onClick={() => setActiveSection("ai")}
            className={"w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors " + (activeSection === "ai" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Bot className="h-4 w-4 inline mr-2" />AI 提供商
          </button>
          <button onClick={() => setActiveSection("tasks")}
            className={"w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors " + (activeSection === "tasks" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Cpu className="h-4 w-4 inline mr-2" />任务映射
          </button>
          <button onClick={() => setActiveSection("system")}
            className={"w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors " + (activeSection === "system" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Shield className="h-4 w-4 inline mr-2" />系统设置
          </button>
          <button onClick={() => setActiveSection("custom-fields")}
            className={"w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors " + (activeSection === "custom-fields" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Eye className="h-4 w-4 inline mr-2" />自定义字段
          </button>
        </div>

        {/* Right: Content */}        {/* Right: Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* AI Providers Section */}
          {activeSection === "ai" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">AI 提供商</CardTitle>
                  <div className="flex gap-1.5 flex-wrap">
                    {PROVIDER_OPTIONS.map(opt => {
                      const isAdded = !!config.providers[opt.id];
                      return (
                        <Button key={opt.id} variant={isAdded ? "secondary" : "outline"} size="sm" className="h-7 text-xs"
                          onClick={() => addProvider(opt.id)} disabled={isAdded}>
                          {isAdded ? <Check className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}{opt.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.keys(config.providers).length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <Bot className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>还没有配置 AI 提供商</p>
                    <p className="text-xs mt-1">点击上方按钮添加你的 API Key</p>
                  </div>
                )}
                {Object.entries(config.providers).map(([id, pcfg]) => {
                  const opt = PROVIDER_OPTIONS.find(o => o.id === id);
                  return (
                    <div key={id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{opt?.name || id}</span>
                          {pcfg.apiKey && <Badge variant="outline" className="h-5 text-xs border-green-200 text-green-700 bg-green-50">已配置</Badge>}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleTest(id)} disabled={testingId === id || !pcfg.apiKey}>
                            {testingId === id ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Globe className="h-3 w-3 mr-1" />}
                            测试连接
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeProvider(id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Label className="text-xs">API Key</Label>
                          <Input type="password" value={pcfg.apiKey} onChange={(e) => updateProvider(id, { ...pcfg, apiKey: e.target.value })}
                            placeholder="sk-..." className="mt-1 h-8 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">使用模型</Label>
                          <Select value={pcfg.model} onValueChange={(v) => v && updateProvider(id, { ...pcfg, model: v })}>
                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {opt?.models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {opt?.hasBaseUrl && (
                        <div className="mt-2">
                          <Label className="text-xs">Base URL</Label>
                          <Input value={pcfg.baseUrl || ""} onChange={(e) => updateProvider(id, { ...pcfg, baseUrl: e.target.value })}
                            placeholder="http://localhost:11434" className="mt-1 h-8 text-xs" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Task Mapping Section */}
          {activeSection === "tasks" && modelOptions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">任务与模型映射</CardTitle>
                <p className="text-sm text-muted-foreground">为每个任务指定使用的 AI 模型，不同任务可用不同模型以平衡效果和成本</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {TASK_OPTIONS.map((task) => (
                  <div key={task.key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm">{task.label}</span>
                    <Select value={config.taskMapping[task.key] || ""} onValueChange={(v) => v && updateTaskMapping(task.key, v)}>
                      <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="选择模型..." /></SelectTrigger>
                      <SelectContent>
                        {modelOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* System Settings */}
          {activeSection === "system" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">通用设置</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>默认货币</Label>
                      <Select defaultValue="USD">
                        <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="CNY">CNY (¥)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>默认贸易术语</Label>
                      <Select defaultValue="FOB">
                        <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FOB">FOB</SelectItem>
                          <SelectItem value="CIF">CIF</SelectItem>
                          <SelectItem value="EXW">EXW</SelectItem>
                          <SelectItem value="DDP">DDP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-4 flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">🔒 隐私说明</p>
                    <p className="text-xs mt-0.5">你的 API Key 仅保存在浏览器本地，不会上传到服务器。调用 AI 时 Key 会通过我们的服务器转发至对应的 AI 提供商。</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "custom-fields" && <CustomFieldsTab />}


          
          {/* Empty task mapping hint */}
          {activeSection === "tasks" && modelOptions.length === 0 && (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              <Cpu className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>暂无可用模型</p>
              <p className="text-xs mt-1">请先在「AI 提供商」中添加并配置 API Key</p>
            </CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}

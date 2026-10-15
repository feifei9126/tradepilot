"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, RefreshCw, Save, ShieldCheck, Trash2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Settings = { effectiveRequestLimit?: number; effectiveTokenLimit?: number; plan?: string; configured: boolean; enabled: boolean; provider: string; model: string; hasApiKey: boolean; monthlyRequestLimit: number; monthlyTokenLimit: number };
type Usage = { month: string; requests: number; tokens: number; failures: number; recent: Array<{ id: string; task: string; provider: string; model: string; status: string; tokens_used: number; failure_code?: string; createdAt: string }> };
const providers = [
  ["openai", "OpenAI"], ["kimi", "Kimi / Moonshot"], ["doubao", "豆包 / 火山方舟"], ["gemini", "Google Gemini"], ["zhipu", "智谱 GLM"], ["deepseek", "DeepSeek"], ["tongyi", "通义千问"], ["openrouter", "OpenRouter"], ["siliconflow", "硅基流动"],
];
const empty: Settings = { configured: false, enabled: true, provider: "openai", model: "", hasApiKey: false, monthlyRequestLimit: 1000, monthlyTokenLimit: 500000 };

export default function AIUsagePage() {
  const [settings, setSettings] = useState<Settings>(empty);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tenant/ai-settings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "读取租户 AI 配置失败");
      setSettings({ ...empty, ...data.settings });
      setUsage(data.usage);
    } catch (error) { toast.error(error instanceof Error ? error.message : "读取失败"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save() {
    if (!settings.model.trim()) { toast.error("请填写模型 ID"); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/tenant/ai-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider:settings.provider, model:settings.model, enabled:settings.enabled, monthlyRequestLimit:settings.monthlyRequestLimit, monthlyTokenLimit:settings.monthlyTokenLimit, apiKey, clearApiKey:clearKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setSettings({ ...empty, ...data.settings }); setUsage(data.usage); setApiKey(""); setClearKey(false);
      window.dispatchEvent(new Event("tradepilot-api-config"));
      toast.success("租户 AI 配置已加密保存");
    } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="rounded-lg border p-3 text-sm">AI 实际额度 = 套餐权益、平台安全上限和你设置的工作区预算三者的最低值；填写更高预算不会升级套餐。当前套餐：{settings.plan || "加载中"}；有效上限：{settings.effectiveRequestLimit ?? 0} 次 / {settings.effectiveTokenLimit ?? 0} Token 每月。订阅到期、欠费或暂停会立即重新计算权益；失败/超时请求也保守计入预算。</p>
    <header className="space-y-2">
      <div className="flex items-center gap-2"><Coins className="size-6 text-primary" /><h1 className="text-2xl font-semibold">租户 AI 配置与用量</h1></div>
      <p className="text-sm text-muted-foreground">每个工作区单独保存自己的 AI 服务商密钥。密钥使用服务器密钥加密存入 PostgreSQL；页面只显示是否已设置，不会再次返回明文。</p>
    </header>
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader><CardTitle className="text-sm">本月请求</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{loading ? "…" : usage?.requests ?? 0}<span className="ml-2 text-sm font-normal text-muted-foreground">/ {settings.effectiveRequestLimit ?? 0}</span></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">本月 Token</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{loading ? "…" : (usage?.tokens ?? 0).toLocaleString()}<span className="ml-2 text-sm font-normal text-muted-foreground">/ {(settings.effectiveTokenLimit ?? 0).toLocaleString()}</span></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">最近失败</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{loading ? "…" : usage?.failures ?? 0}</CardContent></Card>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-4" />工作区模型配置</CardTitle><p className="text-sm text-muted-foreground">请从服务商控制台创建 API Key。使用官方预设地址，租户不能自定义任意 URL，避免将服务器请求转发到内网地址。</p></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">AI 服务商<select value={settings.provider} onChange={event => setSettings({ ...settings, provider: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3">{providers.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="space-y-1 text-sm">模型 ID<Input value={settings.model} onChange={event => setSettings({ ...settings, model: event.target.value })} placeholder="例如 gpt-4o-mini" /></label>
        <label className="space-y-1 text-sm md:col-span-2">API Key<Input type="password" autoComplete="new-password" value={apiKey} onChange={event => { setApiKey(event.target.value); setClearKey(false); }} placeholder={settings.hasApiKey ? "已保存；留空表示不更改" : "粘贴服务商 API Key"} /></label>
        {settings.hasApiKey && <div className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2"><ShieldCheck className="size-4 text-green-600" />密钥已保存且不会回显。若需更换，请直接输入新密钥；若需停用密钥，请使用下方清除按钮。</div>}
        <label className="space-y-1 text-sm">每月最多请求次数<Input type="number" min={1} max={10000} value={settings.monthlyRequestLimit} onChange={event => setSettings({ ...settings, monthlyRequestLimit: Number(event.target.value) })} /></label>
        <label className="space-y-1 text-sm">每月 Token 预算（粗略用量上限）<Input type="number" min={1000} max={10000000} step={1000} value={settings.monthlyTokenLimit} onChange={event => setSettings({ ...settings, monthlyTokenLimit: Number(event.target.value) })} /></label>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={settings.enabled} onChange={event => setSettings({ ...settings, enabled: event.target.checked })} />允许本工作区调用 AI</label>
        <div className="flex flex-wrap gap-2 md:col-span-2"><Button onClick={() => void save()} disabled={busy || loading}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}保存配置</Button><Button variant="outline" onClick={() => void load()} disabled={busy || loading}><RefreshCw className="mr-2 size-4" />刷新用量</Button>{settings.hasApiKey && <Button variant="destructive" onClick={() => { setSettings({ ...settings, enabled: false }); setApiKey(""); setClearKey(true); }} disabled={busy}><Trash2 className="mr-2 size-4" />清除密钥并停用（点保存生效）</Button>}</div>
        <p className="text-xs text-amber-700 md:col-span-2">Token 不是固定货币金额。不同服务商、模型的价格会变化；本页用于请求和 Token 预算兜底，不代替供应商账单、支付订阅或人民币/美元计费。</p>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>最近 AI 调用</CardTitle></CardHeader><CardContent>{!usage?.recent.length ? <p className="text-sm text-muted-foreground">暂无调用记录。记录仅包含功能名、模型、状态和 Token 数，不保存提示词、客户内容或 AI 回复。</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">时间</th><th className="p-2">功能</th><th className="p-2">模型</th><th className="p-2">状态</th><th className="p-2">Token</th></tr></thead><tbody>{usage.recent.map(item => <tr key={item.id} className="border-b"><td className="p-2">{new Date(item.createdAt).toLocaleString()}</td><td className="p-2">{item.task}</td><td className="p-2">{item.model}</td><td className="p-2">{item.status === "success" ? "成功" : item.status === "pending" ? "处理中" : "失败"}</td><td className="p-2">{item.tokens_used.toLocaleString()}</td></tr>)}</tbody></table></div>}</CardContent></Card>
  </div>;
}

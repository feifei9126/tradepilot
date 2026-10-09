"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Settings = { hasApiKey:boolean; enabled:boolean; dailyRequestLimit:number; platformDailyLimit:number; requestsToday:number; canManage:boolean };
export function DiscoverySettingsPanel() {
  const [settings,setSettings] = useState<Settings | null>(null);
  const [apiKey,setApiKey] = useState("");
  const [busy,setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/tenant/discovery-settings",{ cache:"no-store" });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "获客配置读取失败"); setSettings(data);
  },[]);
  useEffect(() => { const timer = setTimeout(() => { void load().catch(e => toast.error(e.message)); },0); return () => clearTimeout(timer); },[load]);
  async function save(enabled: boolean, clearApiKey = false) {
    if (!settings) return; setBusy(true);
    try {
      const response = await fetch("/api/tenant/discovery-settings",{ method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ apiKey,enabled,clearApiKey,dailyRequestLimit:settings.dailyRequestLimit }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "保存失败"); setApiKey(""); await load(); toast.success("本工作区获客配置已保存");
    } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败"); } finally { setBusy(false); }
  }
  return <Card id="discovery-settings"><CardHeader><CardTitle>第 0 步：配置获客搜索服务</CardTitle><CardDescription>每个工作区使用自己的 Firecrawl Cloud Key，不会借用平台或其他租户的 Key。AI 话术另外使用「AI 用量」中的 AI Key。</CardDescription></CardHeader><CardContent className="space-y-4">
    <ol className="list-inside list-decimal space-y-2 text-sm"><li>在 Firecrawl Cloud 注册并复制 API Key（搜索服务可能收费，请先确认服务商余额）。</li><li>由工作区管理员在这里填写 Key 和每日预算，保存并启用；留空 Key 表示保留已保存的密钥。</li><li>创建人设、任务后点击「自动搜索」。每次搜索先预留一次额度；平台管理员的产品抓取也共用该预算。失败也计入请求次数，避免重复请求失控。</li><li>额度按 UTC 自然日统计；实际可用上限取工作区预算与平台安全上限的较小值。单任务仍需间隔 15 分钟。</li></ol>
    {settings ? <><p className="text-sm">状态：{settings.enabled && settings.hasApiKey ? "已启用" : "未启用"} · 今日已请求 {settings.requestsToday} 次 · 平台安全上限 {settings.platformDailyLimit} 次/天</p>
      {settings.canManage ? <div className="space-y-3"><div><Label htmlFor="discovery-key">Firecrawl Cloud API Key（{settings.hasApiKey ? "已保存；不会回显" : "未配置"}）</Label><Input id="discovery-key" type="password" autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={settings.hasApiKey ? "留空保留原密钥" : "填写本工作区自己的 Key"} /></div><div><Label htmlFor="discovery-budget">每日最多搜索/产品抓取请求数</Label><Input id="discovery-budget" type="number" min={1} max={1000} value={settings.dailyRequestLimit} onChange={e => setSettings({ ...settings,dailyRequestLimit:Number(e.target.value) })} /></div><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void save(true)}>保存并启用</Button><Button disabled={busy} variant="outline" onClick={() => void save(false)}>暂停搜索服务</Button><Button disabled={busy || !settings.hasApiKey} variant="outline" onClick={() => void save(false,true)}>移除 Key</Button></div></div> : <p className="text-sm text-muted-foreground">请让工作区所有者或管理员配置 Key；普通成员可查看用量和使用已启用服务。</p>}</> : <p className="text-sm text-muted-foreground">正在读取配置……</p>}
  </CardContent></Card>;
}

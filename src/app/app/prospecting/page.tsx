"use client";

import { UsageGuide } from "@/components/usage-guide";

import { DiscoverySettingsPanel } from "@/components/discovery-settings-panel";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, CheckCircle2, ClipboardCopy, Loader2, Play, Plus, Sparkles, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProspectLead, ProspectingData } from "@/lib/prospecting";

const empty: ProspectingData = { personas: [], tasks: [], leads: [] };
const statusNames: Record<ProspectLead["status"], string> = {
  new: "待审阅", qualified: "高意向", following: "跟进中", rejected: "不匹配", converted: "已转客户",
};

export default function ProspectingPage() {
  const [data, setData] = useState<ProspectingData>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [persona, setPersona] = useState({ name: "", business: "", audience: "", tone: "专业、友好" });
  const [task, setTask] = useState({ personaId: "", name: "", keywords: "", source: "公开网页" });
  const [lead, setLead] = useState({ taskId: "", name: "", sourceUrl: "", excerpt: "", email: "" });
  const [filter, setFilter] = useState("all");
  const [runSummary, setRunSummary] = useState("");
  const [asOf, setAsOf] = useState(0);
  const [editing, setEditing] = useState<Record<string, { notes: string; draft: string; nextFollowUpAt: string }>>({});

  const refresh = useCallback(async () => {
    const response = await fetch("/api/prospecting", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "加载失败");
    setData(result);
    setAsOf(Date.now());
  }, []);
  useEffect(() => { void Promise.resolve().then(refresh).catch(e => toast.error(e.message)).finally(() => setLoading(false)); }, [refresh]);

  async function act(action: string, payload: { data?: unknown; id?: string }, success: string) {
    setBusy(action + (payload.id || ""));
    try {
      const response = await fetch("/api/prospecting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败");
      await refresh();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
      return false;
    } finally { setBusy(""); }
  }
  async function runTask(id: string) {
    setBusy(`discover${id}`);
    setRunSummary("");
    try {
      const response = await fetch("/api/prospecting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discover", id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "搜索失败");
      await refresh();
      setRunSummary(`检索 ${result.found} 条，新增 ${result.added} 条（高意向 ${result.qualified}、不匹配 ${result.rejected}），跳过 ${result.skipped} 条。${result.errors?.join("；") || ""}`);
      toast.success("自动获客已完成");
    } catch (error) { toast.error(error instanceof Error ? error.message : "搜索失败"); }
    finally { setBusy(""); }
  }
  const filtered = data.leads.filter(item => filter === "all" || item.status === filter);
  const draft = (item: ProspectLead) => editing[item.id] || { notes: item.notes, draft: item.draft, nextFollowUpAt: item.nextFollowUpAt };
  const edit = (item: ProspectLead, patch: Partial<ReturnType<typeof draft>>) => setEditing(current => ({ ...current, [item.id]: { ...draft(item), ...patch } }));
  const save = async (item: ProspectLead, status?: ProspectLead["status"]) => {
    if (await act("patch", { data: { id: item.id, ...draft(item), ...(status ? { status } : {}) } }, "线索已更新")) {
      setEditing(current => { const next = { ...current }; delete next[item.id]; return next; });
    }
  };

  return <div className="growth-page">
    <header className="growth-heading">
      <div><p className="growth-path">增长与内容 / AI 获客</p><h1>发现下一位潜在客户</h1>
        <p className="mt-2 text-sm text-muted-foreground">按任务搜索公开网页，自动登记、去重并初筛线索；话术发送仍需人工确认。</p></div>
      <Button variant="outline" render={<Link href="/app/leads" />}>AI 营销方案 <ArrowUpRight className="ml-2 size-4" /></Button>
    </header>
    <p className="service-notice">
      自动搜索需先配置本工作区自己的 Firecrawl Cloud Key。仅处理公开/授权网页的标题和摘要，按关键词自动初筛；不会登录社媒或自动发送消息。结果可能误判，可人工修正。
    </p>
    <UsageGuide title="第一次使用？先看 4 步获客指南" description="接通搜索 → 描述买家 → 创建任务 → 核实并跟进。点击展开使用与配置说明。">
      <Button variant="outline" size="sm" render={<Link href="#discovery-settings" />}>配置本工作区搜索 Key <ArrowUpRight className="ml-2 size-4" /></Button>
      <ol className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <li className="rounded-lg bg-muted/40 p-3"><strong>1. 接通搜索</strong><p className="mt-1 text-muted-foreground">在下面“第 0 步”填写本工作区的 Firecrawl Cloud API Key 并启用。服务器地址固定，无需填写。平台自托管配置不会作为租户备用 Key。没有 Key 时仍可手动登记线索。</p></li>
        <li className="rounded-lg bg-muted/40 p-3"><strong>2. 描述你的客户</strong><p className="mt-1 text-muted-foreground">创建“业务人设”：写清卖什么、希望找哪类买家，以及沟通风格。越具体，筛选越有参考价值。</p></li>
        <li className="rounded-lg bg-muted/40 p-3"><strong>3. 建任务并运行</strong><p className="mt-1 text-muted-foreground">选人设，填写任务名和买家常用关键词（用逗号分隔），点“创建任务”后再点“运行获客”。每个任务至少间隔 15 分钟。</p></li>
        <li className="rounded-lg bg-muted/40 p-3"><strong>4. 人工核实再跟进</strong><p className="mt-1 text-muted-foreground">打开来源核对公司与需求，修正意向状态。确认后才能转入客户库；生成的话术只是草稿，需要你自行审核和发送。</p></li>
      </ol>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">想生成 AI 联系话术：普通租户还需在「AI 用量」中配置自己的文本模型和 AI Key；只有平台管理员的实例操作使用 API 配置中心。Firecrawl 搜索与文本模型是两项独立服务。</p>
    </UsageGuide>
    <DiscoverySettingsPanel />
    <div className="grid gap-3 sm:grid-cols-3">
      {[{ label: "业务人设", count: data.personas.length, Icon: Users }, { label: "筛选任务", count: data.tasks.length, Icon: Target }, { label: "高意向线索", count: data.leads.filter(l => l.status === "qualified").length, Icon: Sparkles }].map(({ label, count, Icon }) => <Card key={label}><CardContent className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{count}</p></div><Icon className="size-5 text-primary" /></CardContent></Card>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <Card><CardHeader><CardTitle>1. 业务人设</CardTitle><CardDescription>描述你的业务与理想客户</CardDescription></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (await act("persona", { data: persona }, "人设已创建")) setPersona({ name: "", business: "", audience: "", tone: "专业、友好" }); }}>
          <Label htmlFor="persona-name">名称</Label><Input id="persona-name" required maxLength={200} value={persona.name} onChange={e => setPersona({ ...persona, name: e.target.value })} placeholder="例：欧洲电子产品批发商" />
          <Label htmlFor="persona-business">主营业务</Label><Textarea id="persona-business" required maxLength={2000} value={persona.business} onChange={e => setPersona({ ...persona, business: e.target.value })} />
          <Label htmlFor="persona-audience">目标客户</Label><Textarea id="persona-audience" required maxLength={2000} value={persona.audience} onChange={e => setPersona({ ...persona, audience: e.target.value })} />
          <Label htmlFor="persona-tone">沟通风格</Label><Input id="persona-tone" maxLength={200} value={persona.tone} onChange={e => setPersona({ ...persona, tone: e.target.value })} />
          <Button disabled={!!busy} type="submit"><Plus className="mr-2 size-4" />创建人设</Button>
        </form>
        {data.personas.length > 0 && <ul className="mt-4 space-y-2 border-t pt-3 text-sm">{data.personas.map(p => <li key={p.id}><strong>{p.name}</strong><span className="ml-2 text-muted-foreground">{p.audience}</span></li>)}</ul>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>2. 线索筛选任务</CardTitle><CardDescription>创建后点击“运行获客”，自动搜索、登记与初筛公开网页</CardDescription></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (await act("task", { data: { ...task, keywords: task.keywords.split(/[,，、\n]+/).map(k => k.trim()).filter(Boolean) } }, "任务已创建")) setTask({ ...task, name: "", keywords: "" }); }}>
          <Label htmlFor="task-persona">关联人设</Label><select id="task-persona" required className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={task.personaId} onChange={e => setTask({ ...task, personaId: e.target.value })}><option value="">请选择</option>{data.personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <Label htmlFor="task-name">任务名称</Label><Input id="task-name" required maxLength={200} value={task.name} onChange={e => setTask({ ...task, name: e.target.value })} placeholder="例：德国采购商线索" />
          <Label htmlFor="task-keywords">关键词（逗号分隔）</Label><Input id="task-keywords" required value={task.keywords} onChange={e => setTask({ ...task, keywords: e.target.value })} placeholder="采购, 蓝牙耳机, 批发" />
          <Label htmlFor="task-source">来源说明</Label><Input id="task-source" required maxLength={80} value={task.source} onChange={e => setTask({ ...task, source: e.target.value })} placeholder="公开网页 / 授权平台" />
          <Button disabled={!!busy || !data.personas.length} type="submit"><Plus className="mr-2 size-4" />创建任务</Button>
        </form>
        {runSummary && <p role="status" className="mt-3 rounded-md border p-3 text-sm">{runSummary}</p>}
        {data.tasks.length > 0 && <ul className="mt-4 space-y-2 border-t pt-3 text-sm">{data.tasks.map(t => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2"><div><strong>{t.name}</strong><span className="ml-2 text-muted-foreground">{t.keywords.join(" · ")}</span>{t.lastRunAt && <p className="text-xs text-muted-foreground">上次运行：{new Date(t.lastRunAt).toLocaleString()}{t.lastRunError && ` · ${t.lastRunError}`}</p>}</div><Button size="sm" variant="outline" disabled={!!busy || (!!t.lastRunAt && asOf - Date.parse(t.lastRunAt) < 15 * 60_000)} onClick={() => void runTask(t.id)}>{busy === `discover${t.id}` ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Play className="mr-1 size-4" />}运行获客</Button></li>)}</ul>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>3. 手动补录（可选）</CardTitle><CardDescription>自动搜索未覆盖的授权来源可在这里补充</CardDescription></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (await act("lead", { data: lead }, "线索已登记")) setLead({ ...lead, name: "", sourceUrl: "", excerpt: "", email: "" }); }}>
          <Label htmlFor="lead-task">关联任务</Label><select id="lead-task" required className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={lead.taskId} onChange={e => setLead({ ...lead, taskId: e.target.value })}><option value="">请选择</option>{data.tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <Label htmlFor="lead-name">客户/企业名称</Label><Input id="lead-name" required maxLength={200} value={lead.name} onChange={e => setLead({ ...lead, name: e.target.value })} />
          <Label htmlFor="lead-url">公开来源链接</Label><Input id="lead-url" type="url" required maxLength={2048} value={lead.sourceUrl} onChange={e => setLead({ ...lead, sourceUrl: e.target.value })} placeholder="https://..." />
          <Label htmlFor="lead-excerpt">需求/互动内容</Label><Textarea id="lead-excerpt" required maxLength={2000} value={lead.excerpt} onChange={e => setLead({ ...lead, excerpt: e.target.value })} />
          <Label htmlFor="lead-email">邮箱（可选，需授权）</Label><Input id="lead-email" type="email" value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })} />
          <Button disabled={!!busy || !data.tasks.length} type="submit"><Plus className="mr-2 size-4" />登记并评分</Button>
        </form>
      </CardContent></Card>
    </div>
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">线索结果</h2><p className="text-sm text-muted-foreground">自动初筛可修正；AI 仅生成草稿，不自动触达</p></div>
      <select aria-label="按状态筛选线索" className="h-9 rounded-md border bg-background px-3 text-sm" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部状态</option>{Object.entries(statusNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {loading ? <Loader2 className="size-6 animate-spin" /> : filtered.length === 0 ? <p className="rounded-lg border p-6 text-sm text-muted-foreground">暂无线索。先建立业务人设和任务，点击运行获客。</p> : filtered.map(item => <Card key={item.id}><CardHeader><div className="flex flex-wrap justify-between gap-2"><div><CardTitle>{item.name} <span className="ml-2 text-sm font-normal text-primary">{item.score} 分 · {statusNames[item.status]}{item.discovery === "automatic" ? " · 自动发现" : ""}</span></CardTitle><CardDescription>{data.tasks.find(t => t.id === item.taskId)?.name} · {new Date(item.createdAt).toLocaleString()}</CardDescription></div><a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">查看来源 <ArrowUpRight className="size-4" /></a></div></CardHeader><CardContent className="space-y-3">
        <p className="whitespace-pre-wrap text-sm">{item.excerpt}</p><p className="text-xs text-muted-foreground">{item.reasons.length ? item.reasons.join(" · ") : "尚未命中关键词，建议人工核实"}{item.email && ` · ${item.email}`}</p>
        {item.status !== "converted" ? <><div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor={`notes-${item.id}`}>跟进备注</Label><Textarea id={`notes-${item.id}`} maxLength={2000} value={draft(item).notes} onChange={e => edit(item, { notes: e.target.value })} /></div><div><Label htmlFor={`date-${item.id}`}>下次跟进</Label><Input id={`date-${item.id}`} type="date" value={draft(item).nextFollowUpAt} onChange={e => edit(item, { nextFollowUpAt: e.target.value })} /></div></div>
          <div><Label htmlFor={`draft-${item.id}`}>AI 话术草稿（可编辑）</Label><Textarea id={`draft-${item.id}`} className="mt-1 min-h-24" maxLength={4000} value={draft(item).draft} onChange={e => edit(item, { draft: e.target.value })} /></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!!busy} onClick={() => void (async () => { if (editing[item.id] && !(await act("patch", { data: { id: item.id, ...draft(item) } }, "当前编辑已保存"))) return; if (await act("draft", { id: item.id }, "草稿已生成，请审阅后再使用")) setEditing(current => { const next = { ...current }; delete next[item.id]; return next; }); })()}><Sparkles className="mr-1 size-4" />生成草稿</Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void save(item)}>保存备注/草稿</Button>
            <Button size="sm" variant="outline" disabled={!!busy || !draft(item).draft} onClick={() => void navigator.clipboard.writeText(draft(item).draft).then(() => toast.success("已复制，请人工确认后发送")).catch(() => toast.error("复制失败"))}><ClipboardCopy className="mr-1 size-4" />复制草稿</Button>
            {item.status === "new" && <><Button size="sm" disabled={!!busy} onClick={() => void save(item, "qualified")}>标记高意向</Button><Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void save(item, "rejected")}>不匹配</Button></>}
            {item.status === "qualified" && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void save(item, "rejected")}>标记不匹配</Button>}
            {item.status === "rejected" && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void save(item, "new")}>重新审阅</Button>}
            {item.status === "qualified" && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void save(item, "following")}>跟进中</Button>}
            {(item.status === "qualified" || item.status === "following") && <Button size="sm" disabled={!!busy} onClick={() => void act("promote", { id: item.id }, "已转入客户库")}><CheckCircle2 className="mr-1 size-4" />转入客户库</Button>}
          </div></> : <Link className="text-sm text-primary hover:underline" href={`/app/contacts/${item.contactId}`}>查看客户详情 →</Link>}
      </CardContent></Card>)}
    </section>
  </div>;
}

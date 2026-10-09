"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Copy, LoaderCircle, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Workspace = { id: string; name: string; slug: string; isActive: boolean; memberLimit: number; memberCount: number; activeMemberCount: number; createdAt: string };
type Audit = { id: string; companyId: string; actorId: string; action: string; createdAt: string };
type Credentials = { email: string; password: string; workspace: string };
const actionLabels: Record<string, string> = { "workspace.create": "创建工作区", "workspace.update": "更新工作区", "team.member.create": "添加成员", "team.member.update": "更新成员", "team.member.password_reset": "重置临时密码" };

export function SaasManagementPanel() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", slug: "", memberLimit: 20, ownerName: "", ownerEmail: "" });
  const load = useCallback((signal?: AbortSignal) => {
    return fetch("/api/admin/workspaces", { cache: "no-store", signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "工作区加载失败");
        return data;
      })
      .then(data => {
        if (signal?.aborted) return;
        setWorkspaces(data.workspaces);
        setAudit(data.audit);
        setLimits(Object.fromEntries(data.workspaces.map((workspace: Workspace) => [workspace.id, workspace.memberLimit])));
      })
      .catch(cause => {
        if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "工作区加载失败");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice(""); setCredentials(null);
    try {
      const response = await fetch("/api/admin/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "创建工作区失败");
      setCredentials({ email: data.owner.email, password: data.temporaryPassword, workspace: data.workspace.name });
      setForm({ name: "", slug: "", memberLimit: 20, ownerName: "", ownerEmail: "" });
      setNotice("工作区与所有者已创建。请把临时登录信息通过安全渠道交给所有者，首次登录必须改密。");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "创建工作区失败"); }
    finally { setBusy(false); }
  }
  async function update(workspace: Workspace, changes: { isActive?: boolean; memberLimit?: number }) {
    if (changes.isActive === false && !window.confirm(`确定停用「${workspace.name}」？全部成员将无法使用，已有会话会被撤销。数据不会删除。`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/workspaces", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: workspace.id, ...changes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "更新失败");
      setNotice("工作区已更新。启停操作会撤销全部成员旧会话，重新启用后需重新登录。"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "更新失败"); }
    finally { setBusy(false); }
  }
  async function copy() {
    if (!credentials) return;
    try { await navigator.clipboard.writeText(`工作区：${credentials.workspace}\n账号：${credentials.email}\n临时密码：${credentials.password}`); setNotice("已复制。请勿在公共群或工单中分享临时密码。"); }
    catch { setError("剪贴板不可用，请手动复制"); }
  }
  return (
    <div className="page-stack mx-auto max-w-7xl">
      <div className="page-heading"><div><p className="page-kicker">PLATFORM / SAAS MANAGEMENT</p><h1>SaaS 工作区管理</h1><p className="page-description">为不同客户建立独立工作区，设置成员上限与使用状态。只允许平台管理员访问。</p></div><Button variant="outline" disabled={busy || loading} onClick={() => { setError(""); void load(); }}><RefreshCw className="size-4" />刷新</Button></div>
      <Card className="border-blue-500/20 bg-blue-500/5"><CardContent className="space-y-2 pt-5 text-sm"><p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4" />初次使用：先建工作区，再由所有者添加同事</p><p className="text-muted-foreground">① 填写客户公司与所有者邮箱 → ② 安全交付一次性显示的临时密码 → ③ 所有者登录「个人中心」改密 → ④ 在「团队成员」添加同事。各工作区业务数据分开保存，平台身份不会自动切换进客户工作区。</p><p className="text-muted-foreground">自助注册保持关闭；这里管理的是工作区与账号，尚不包含支付、订阅账单或租户 AI 费用配额。实例级 AI、采集、语音与视频服务仍限制平台使用，不能作为完整收费 SaaS 上线承诺。<Link href="/app/database" className="ml-1 text-primary underline">查看数据库状态</Link></p></CardContent></Card>
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-emerald-500/30 p-3 text-sm">{notice}</p>}
      {credentials && <Card className="border-amber-500/40 bg-amber-500/5"><CardHeader><CardTitle className="text-base">临时登录信息 · 仅显示一次</CardTitle><CardDescription>关闭此提示或离开页面后不会再次显示，未保存时需要重置密码。</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1 break-all rounded-md border bg-background p-3 font-mono text-sm"><p>工作区：{credentials.workspace}</p><p>账号：{credentials.email}</p><p>临时密码：<strong>{credentials.password}</strong></p></div><Button variant="outline" onClick={() => void copy()}><Copy className="size-4" />复制</Button><Button variant="ghost" onClick={() => setCredentials(null)}>已保存，关闭</Button></CardContent></Card>}
      <div className="grid gap-4 sm:grid-cols-3">{[{ label: "工作区总数", value: workspaces.length, icon: Building2 }, { label: "启用工作区", value: workspaces.filter(w => w.isActive).length, icon: ShieldCheck }, { label: "活跃成员", value: workspaces.reduce((sum, w) => sum + w.activeMemberCount, 0), icon: Users }].map(stat => <Card key={stat.label}><CardContent className="flex items-center justify-between pt-5"><div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-1 text-2xl font-semibold">{loading ? "—" : stat.value}</p></div><stat.icon className="size-5 text-primary" /></CardContent></Card>)}</div>
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.6fr)]">
        <Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-4" />新建客户工作区</CardTitle><CardDescription>每个工作区创建一名所有者。邮箱在整个系统内唯一，成员上限包含所有者。</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={create}>
          <div className="space-y-2"><Label htmlFor="saas-name">公司 / 工作区名称</Label><Input id="saas-name" required maxLength={120} placeholder="例如：远航贸易" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="saas-slug">唯一标识</Label><Input id="saas-slug" required minLength={2} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="例如：yuanhang-trade" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase() })} /><p className="text-xs text-muted-foreground">小写英文、数字和短横线，不是登录密码。</p></div>
          <div className="space-y-2"><Label htmlFor="saas-owner">所有者姓名</Label><Input id="saas-owner" required maxLength={100} value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="saas-email">所有者邮箱</Label><Input id="saas-email" required type="email" maxLength={255} autoComplete="off" value={form.ownerEmail} onChange={e => setForm({ ...form, ownerEmail: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="saas-limit">活跃成员上限</Label><Input id="saas-limit" required type="number" min={1} max={10000} value={form.memberLimit} onChange={e => setForm({ ...form, memberLimit: Number(e.target.value) })} /></div>
          <Button className="w-full" disabled={busy || loading} type="submit">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}创建工作区和所有者</Button>
        </form></CardContent></Card>
        <Card><CardHeader><CardTitle>工作区列表</CardTitle><CardDescription>停用会撤销会话但保留数据；成员上限不能低于当前活跃人数。当前平台管理工作区不可停用。</CardDescription></CardHeader><CardContent>{loading ? <p role="status" className="py-8 text-center text-muted-foreground">正在加载…</p> : !workspaces.length ? <p className="py-8 text-center text-muted-foreground">暂无工作区，请先初始化数据库。</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="p-3">工作区</th><th className="p-3">成员</th><th className="p-3">上限</th><th className="p-3">状态</th></tr></thead><tbody>{workspaces.map(w => <tr key={w.id} className="border-b last:border-0"><td className="p-3"><p className="font-medium">{w.name}</p><p className="text-xs text-muted-foreground">{w.slug}</p></td><td className="p-3"><p>{w.activeMemberCount} 活跃 / {w.memberCount} 总数</p></td><td className="p-3"><div className="flex items-center gap-2"><Input aria-label={`${w.name}成员上限`} className="w-20" type="number" min={1} max={10000} value={limits[w.id] ?? w.memberLimit} onChange={e => setLimits({ ...limits, [w.id]: Number(e.target.value) })} /><Button size="xs" variant="outline" disabled={busy || limits[w.id] === w.memberLimit} onClick={() => void update(w, { memberLimit: limits[w.id] })}>保存</Button></div></td><td className="p-3"><div className="flex items-center gap-2"><span className={w.isActive ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>{w.isActive ? "启用" : "已停用"}</span><Button size="xs" variant="outline" disabled={busy} onClick={() => void update(w, { isActive: !w.isActive })}>{w.isActive ? "停用" : "重新启用"}</Button></div></td></tr>)}</tbody></table></div>}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>最近管理审计</CardTitle><CardDescription>最近 50 条工作区与成员操作，不记录密码；只读展示，不能在页面删除审计。</CardDescription></CardHeader><CardContent>{!audit.length ? <p className="text-sm text-muted-foreground">暂无管理操作记录。</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b text-muted-foreground"><th className="p-2">时间</th><th className="p-2">操作</th><th className="p-2">工作区</th><th className="p-2">操作者</th></tr></thead><tbody>{audit.map(row => <tr key={row.id} className="border-b last:border-0"><td className="p-2">{new Date(row.createdAt).toLocaleString()}</td><td className="p-2">{actionLabels[row.action] || row.action}</td><td className="p-2">{workspaces.find(w => w.id === row.companyId)?.name || row.companyId}</td><td className="p-2 font-mono">{row.actorId}</td></tr>)}</tbody></table></div>}</CardContent></Card>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, LoaderCircle, ShieldCheck, UserPlus, UserRound, UserRoundX, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Member = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
};

type CreatedCredentials = { email: string; password: string } | null;

const roleLabel: Record<Member["role"], string> = { owner: "所有者", admin: "管理员", member: "成员" };

export function TeamManagementPanel({ currentUserId, role }: { currentUserId: string; role: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [memberLimit, setMemberLimit] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<CreatedCredentials>(null);
  const [copied, setCopied] = useState(false);

  const loadMembers = useCallback((signal?: AbortSignal) => {
    return fetch("/api/team/users", { cache: "no-store", signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "成员列表加载失败");
        return data;
      })
      .then(data => {
        if (signal?.aborted) return;
        setMembers(data.members as Member[]);
        setMemberLimit(data.memberLimit);
        setActiveCount(data.activeMemberCount);
      })
      .catch(cause => {
        if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "成员列表加载失败");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadMembers(controller.signal);
    return () => controller.abort();
  }, [loadMembers]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    setCreated(null);
    try {
      const response = await fetch("/api/team/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role: newRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "添加成员失败");
      setCreated({ email: data.user.email, password: data.temporaryPassword });
      setName("");
      setEmail("");
      setNewRole("member");
      setNotice("成员已添加。临时密码只会显示这一次，请通过安全渠道交给对方。");
      await loadMembers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "添加成员失败");
    } finally {
      setSaving(false);
    }
  }

  async function updateMember(member: Member, changes: { role?: "admin" | "member"; isActive?: boolean }) {
    if (changes.isActive === false && !window.confirm(`确定停用 ${member.name}？已有登录会话将撤销。`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/team/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, ...changes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "更新成员失败");
      setNotice(`${member.name} 的成员状态已更新。旧登录会话已撤销。`);
      await loadMembers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新成员失败");
    } finally { setSaving(false); }
  }

  async function resetPassword(member: Member) {
    if (!window.confirm(`重置 ${member.name} 的密码？旧密码和已有会话立即失效，对方需要用新临时密码登录并改密。`)) return;
    setSaving(true); setError(""); setNotice(""); setCreated(null);
    try {
      const response = await fetch("/api/team/users/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "重置密码失败");
      setCreated({ email: data.user.email, password: data.temporaryPassword });
      setNotice("临时密码已重置，只显示一次。已有会话已撤销。");
      await loadMembers();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "重置密码失败"); }
    finally { setSaving(false); }
  }

  async function copyTemporaryPassword() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`账号：${created.email}\n临时密码：${created.password}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("浏览器未授权剪贴板，请手动复制临时密码");
    }
  }

  const isOwner = role === "owner";

  return (
    <div className="page-stack mx-auto max-w-6xl">
      <div className="page-heading">
        <div>
          <p className="page-kicker">WORKSPACE / ACCESS CONTROL</p>
          <h1>团队成员</h1>
          <p className="page-description">添加同一工作区的同事、分配管理员权限或停用账号。新成员首次登录后必须立即修改临时密码。</p>
        </div>
      </div>

      <Card className="border-blue-500/20 bg-blue-500/5"><CardContent className="space-y-2 pt-5 text-sm"><p className="font-medium">活跃成员：{loading ? "—" : `${activeCount} / ${memberLimit}`}（包含所有者，停用成员不占额度）</p><p className="text-muted-foreground">所有者可添加管理员或成员；管理员仅能管理普通成员；成员使用同一工作区业务功能，不能管理团队。所有者不可在此降权、停用或重置，请在个人中心改密。角色变更、停用、密码重置会撤销旧会话。</p><p className="text-muted-foreground">这是为同一家公司添加同事。如果需要为另一家客户建立独立数据空间，请由平台管理员使用「SaaS 工作区」。</p></CardContent></Card>
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {created && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">请立即保存临时登录信息</CardTitle>
            <CardDescription>出于安全原因，离开此页面后不会再次显示此临时密码。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm">
              <div className="truncate">账号：{created.email}</div>
              <div>临时密码：<strong>{created.password}</strong></div>
            </div>
            <Button type="button" variant="outline" onClick={copyTemporaryPassword}><Copy className="size-4" />{copied ? "已复制" : "复制登录信息"}</Button>
            <Button type="button" variant="ghost" onClick={() => setCreated(null)}>我已保存</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="size-4" />添加成员</CardTitle>
            <CardDescription>账号直接加入当前工作区，不会创建新的租户。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={addMember}>
              <div className="space-y-2"><Label htmlFor="team-name">姓名</Label><Input id="team-name" autoComplete="name" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="team-email">工作邮箱</Label><Input id="team-email" type="email" autoComplete="email" maxLength={255} required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="team-role">角色</Label>
                <select id="team-role" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newRole} onChange={(event) => setNewRole(event.target.value as "admin" | "member")}>
                  <option value="member">成员 — 使用工作区业务功能</option>
                  {isOwner && <option value="admin">管理员 — 可管理普通成员</option>}
                </select>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">管理员不能提升其他管理员或所有者。成员管理目前不发送邮件，创建后请安全地转交一次性显示的临时密码。</p>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}添加到工作区</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" />成员与权限</CardTitle><CardDescription className="mt-1">成员列表按当前工作区隔离；停用或改权后，现有会话会失效。</CardDescription></div>
            <Button type="button" variant="outline" size="sm" onClick={() => { setLoading(true); setError(""); void loadMembers(); }} disabled={loading}>{loading ? "加载中" : "刷新"}</Button>
          </CardHeader>
          <CardContent>
            {loading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">正在读取成员…</p> : members.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">数据库中尚无成员，请先初始化数据库。</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground"><th className="px-3 py-3 font-medium">成员</th><th className="px-3 py-3 font-medium">角色</th><th className="px-3 py-3 font-medium">最近登录</th><th className="px-3 py-3 font-medium">状态/操作</th></tr></thead>
                  <tbody>
                    {members.map((member) => {
                      const canChange = member.id !== currentUserId && member.role !== "owner" && (isOwner || member.role === "member");
                      return <tr key={member.id} className="border-b last:border-0">
                        <td className="px-3 py-4"><div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="size-4" /></span><div className="min-w-0"><div className="flex items-center gap-2 font-medium">{member.name}{member.id === currentUserId && <span className="text-xs text-muted-foreground">（我）</span>}</div><div className="truncate text-xs text-muted-foreground">{member.email}</div></div></div></td>
                        <td className="px-3 py-4">{member.role === "owner" ? <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">所有者</span> : isOwner ? <select aria-label={`${member.name}角色`} className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={member.role} disabled={!canChange || saving} onChange={(event) => void updateMember(member, { role: event.target.value as "admin" | "member" })}><option value="member">成员</option><option value="admin">管理员</option></select> : <span>{roleLabel[member.role]}</span>}</td>
                        <td className="px-3 py-4 text-xs text-muted-foreground">{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : "尚未登录"}</td>
                        <td className="px-3 py-4"><div className="flex items-center gap-2"><span className={member.isActive ? "rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300" : "rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"}>{member.isActive ? "启用" : "已停用"}</span>{member.mustChangePassword && <span className="text-xs text-amber-700 dark:text-amber-300">待改密</span>}{canChange && <Button type="button" size="xs" variant={member.isActive ? "outline" : "secondary"} disabled={saving} onClick={() => void updateMember(member, { isActive: !member.isActive })}>{member.isActive ? <><UserRoundX className="size-3.5" />停用</> : "重新启用"}</Button>}{canChange && <Button size="xs" variant="outline" disabled={saving} onClick={() => void resetPassword(member)}><KeyRound className="size-3.5" />重置密码</Button>}</div></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

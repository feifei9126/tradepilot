"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signOut, useSession } from "next-auth/react";
import { UserRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation, type Locale } from "@/lib/i18n";

type Profile = { name: string; email: string; locale: Locale; timezone: string };
const timezones = ["Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "UTC"];

export default function AccountPage() {
  const { update } = useSession();
  const { setLocale } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/account", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "加载失败");
      if (active) setProfile(data as Profile);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: profile.name, locale: profile.locale, timezone: profile.timezone }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setProfile(data as Profile);
      setLocale(data.locale);
      await update();
      setMessage("个人设置已保存");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setSaving(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setChanging(true); setPasswordError("");
    try {
      const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "修改失败");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      await signOut({ callbackUrl: "/auth/login?passwordChanged=1" });
    } catch (cause) { setPasswordError(cause instanceof Error ? cause.message : "修改失败"); }
    finally { setChanging(false); }
  }

  return (
    <div className="page-stack mx-auto max-w-4xl">
      <div className="page-heading">
        <div>
          <p className="page-kicker">ACCOUNT / PROFILE</p>
          <h1>个人中心</h1>
          <p className="page-description">管理个人资料和登录密码。邮箱由部署配置或注册信息决定，暂不支持在此修改。</p>
        </div>
      </div>
      {loading && <p role="status" className="text-sm text-muted-foreground">正在加载个人设置…</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-4" />基本资料</CardTitle><CardDescription>保存后会同步到当前账号。</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveProfile}>
              <div className="space-y-2"><Label htmlFor="profile-email">登录邮箱</Label><Input id="profile-email" type="email" value={profile?.email || ""} readOnly disabled /></div>
              <div className="space-y-2"><Label htmlFor="profile-name">显示名称</Label><Input id="profile-name" autoComplete="name" maxLength={100} required value={profile?.name || ""} onChange={(event) => setProfile((prev) => prev && { ...prev, name: event.target.value })} disabled={!profile} /></div>
              <div className="space-y-2"><Label htmlFor="profile-locale">界面语言</Label><select id="profile-locale" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={profile?.locale || "zh"} onChange={(event) => setProfile((prev) => prev && { ...prev, locale: event.target.value as Locale })} disabled={!profile}><option value="zh">中文</option><option value="en">English</option></select></div>
              <div className="space-y-2"><Label htmlFor="profile-timezone">时区</Label><select id="profile-timezone" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={profile?.timezone || "Asia/Shanghai"} onChange={(event) => setProfile((prev) => prev && { ...prev, timezone: event.target.value })} disabled={!profile}>{timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select><p className="text-xs text-muted-foreground">个人偏好，业务数据时间显示暂未统一切换。</p></div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
              <Button type="submit" disabled={!profile || saving}>{saving ? "保存中…" : "保存个人设置"}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="size-4" />修改密码</CardTitle><CardDescription>需要验证当前密码；修改成功后会退出当前登录，请使用新密码重新登录。</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={changePassword}>
              <div className="space-y-2"><Label htmlFor="current-password">当前密码</Label><Input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="new-password">新密码</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><p className="text-xs text-muted-foreground">至少 8 位；建议使用独一无二的强密码。</p></div>
              <div className="space-y-2"><Label htmlFor="confirm-password">确认新密码</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
              {passwordError && <p role="alert" className="text-sm text-destructive">{passwordError}</p>}
              <Button type="submit" variant="outline" disabled={changing || !profile}>{changing ? "修改中…" : "确认修改密码"}</Button>
              <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" />部署管理员密码会以哈希形式保存到服务器数据卷，覆盖初始环境变量密码；不会写回 .env。</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

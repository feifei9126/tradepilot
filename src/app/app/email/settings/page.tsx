"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Mail, Plus, Trash2, Settings, RefreshCw, ArrowLeft,
  Check, X, Server, Shield
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function EmailSettingsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAccount, setNewAccount] = useState<any>({ name: '', email: '', imapHost: '', imapPort: '993', smtpHost: '', smtpPort: '465', username: '', password: '' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    setLoading(true);
    try {
      const r = await fetch("/api/email/accounts");
      const d = await r.json();
      if (d.accounts) setAccounts(d.accounts);
    } catch {}
    setLoading(false);
  }

  async function addAccount() {
    if (!newAccount.name || !newAccount.email) { toast.error("请填写显示名称和邮箱"); return; }
    try {
      const r = await fetch("/api/email/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newAccount, imapPort: parseInt(newAccount.imapPort), smtpPort: parseInt(newAccount.smtpPort) }),
      });
      if (r.ok) { toast.success("账户已添加"); setNewAccount({ name:'', email:'', imapHost:'', imapPort:'993', smtpHost:'', smtpPort:'465', username:'', password:'' }); setShowForm(false); loadAccounts(); }
      else toast.error("添加失败");
    } catch { toast.error("添加失败"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-primary hover:underline mb-1 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />返回邮件收件箱
          </button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            邮箱设置
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">配置 IMAP/SMTP 邮件账户</p>
        </div>
        <Button size="sm" className="h-9" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4 mr-1.5" />添加账户
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
          ) : accounts.length === 0 ? (
            <div className="py-10 text-center border rounded-lg">
              <Mail className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">尚未配置邮箱账户</p>
              <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />添加第一个账户
              </Button>
            </div>
          ) : accounts.map((a, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">IMAP {a.imapHost}:{a.imapPort}</span>
                      <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">SMTP {a.smtpHost}:{a.smtpPort}</span>
                    </div>
                  </div>
                </div>
                <Badge variant={a.syncEnabled ? "default" : "secondary"} className="text-xs">
                  {a.syncEnabled ? "同步中" : "已停用"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {showForm && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">新增邮箱账户</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">显示名称</label>
                  <Input className="h-8 text-xs" placeholder="公司邮箱" value={newAccount.name}
                    onChange={e => setNewAccount({...newAccount, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">邮箱地址</label>
                  <Input className="h-8 text-xs" placeholder="sales@company.com" value={newAccount.email}
                    onChange={e => setNewAccount({...newAccount, email: e.target.value})} />
                </div>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">IMAP 收件</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input className="h-8 text-xs" placeholder="imap.example.com" value={newAccount.imapHost}
                      onChange={e => setNewAccount({...newAccount, imapHost: e.target.value})} />
                  </div>
                  <div>
                    <Input className="h-8 text-xs" placeholder="993" value={newAccount.imapPort}
                      onChange={e => setNewAccount({...newAccount, imapPort: e.target.value})} />
                  </div>
                </div>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">SMTP 发件</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input className="h-8 text-xs" placeholder="smtp.example.com" value={newAccount.smtpHost}
                      onChange={e => setNewAccount({...newAccount, smtpHost: e.target.value})} />
                  </div>
                  <div>
                    <Input className="h-8 text-xs" placeholder="465" value={newAccount.smtpPort}
                      onChange={e => setNewAccount({...newAccount, smtpPort: e.target.value})} />
                  </div>
                </div>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">认证信息</p>
                <div>
                  <label className="text-xs text-muted-foreground">用户名</label>
                  <Input className="h-8 text-xs" placeholder="邮箱地址" value={newAccount.username}
                    onChange={e => setNewAccount({...newAccount, username: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">密码</label>
                  <Input type="password" className="h-8 text-xs" placeholder="登录密码" value={newAccount.password}
                    onChange={e => setNewAccount({...newAccount, password: e.target.value})} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => setShowForm(false)}>
                    <X className="h-3.5 w-3.5 mr-1" />取消
                  </Button>
                  <Button size="sm" className="h-8 text-xs flex-1" onClick={addAccount}>
                    <Check className="h-3.5 w-3.5 mr-1" />保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-3 text-xs text-blue-700 flex items-start gap-2">
              <Shield className="h-4 w-4 shrink-0 mt-0.5" />
              密码会加密存储，建议使用专用APP密码。
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

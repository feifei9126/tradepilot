"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Link from "next/link";
import {
  Mail,
  Plus,
  Settings,
  ArrowLeft,
  Check,
  X,
  Shield,
} from "lucide-react";

interface EmailAccountView {
  id: string;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

interface NewEmailAccount {
  name: string;
  email: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  username: string;
}

const EMPTY_ACCOUNT: NewEmailAccount = {
  name: "",
  email: "",
  imapHost: "",
  imapPort: "993",
  smtpHost: "",
  smtpPort: "465",
  username: "",
};

export default function EmailSettingsPage() {
  const [accounts, setAccounts] = useState<EmailAccountView[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAccount, setNewAccount] = useState<NewEmailAccount>(EMPTY_ACCOUNT);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoading(true);
    try {
      const r = await fetch("/api/email/accounts");
      const d = await r.json();
      if (!r.ok || !Array.isArray(d.accounts))
        throw new Error(d.error || "邮箱参数加载失败");
      setAccounts(d.accounts);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "邮箱参数加载失败");
    }
    setLoading(false);
  }

  async function addAccount() {
    if (
      !newAccount.name ||
      !newAccount.email ||
      !newAccount.imapHost ||
      !newAccount.smtpHost
    ) {
      toast.error("请填写名称、邮箱和服务器地址");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/email/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAccount,
          imapPort: parseInt(newAccount.imapPort),
          smtpPort: parseInt(newAccount.smtpPort),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "保存失败");
      toast.success("连接参数草稿已保存");
      setNewAccount(EMPTY_ACCOUNT);
      setShowForm(false);
      await loadAccounts();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/app/email"
            className="text-sm text-primary hover:underline mb-1 flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            返回邮件收件箱
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            邮箱设置
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            记录 IMAP/SMTP 连接参数草稿
          </p>
        </div>
        <Button
          size="sm"
          className="h-9"
          onClick={() => setShowForm(true)}
          disabled={showForm}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          添加参数
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-10 text-center border rounded-lg">
              <Mail className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                尚未保存邮箱连接参数
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-8 text-xs"
                onClick={() => setShowForm(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                添加第一组参数
              </Button>
            </div>
          ) : (
            accounts.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                          IMAP {a.imapHost}:{a.imapPort}
                        </span>
                        <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
                          SMTP {a.smtpHost}:{a.smtpPort}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    参数草稿
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-3">
          {showForm && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">新增连接参数</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">
                    显示名称
                  </label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="公司邮箱"
                    value={newAccount.name}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    邮箱地址
                  </label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="sales@company.com"
                    value={newAccount.email}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, email: e.target.value })
                    }
                  />
                </div>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">
                  IMAP 收件
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      className="h-8 text-xs"
                      placeholder="imap.example.com"
                      value={newAccount.imapHost}
                      onChange={(e) =>
                        setNewAccount({
                          ...newAccount,
                          imapHost: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Input
                      className="h-8 text-xs"
                      placeholder="993"
                      value={newAccount.imapPort}
                      onChange={(e) =>
                        setNewAccount({
                          ...newAccount,
                          imapPort: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">
                  SMTP 发件
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      className="h-8 text-xs"
                      placeholder="smtp.example.com"
                      value={newAccount.smtpHost}
                      onChange={(e) =>
                        setNewAccount({
                          ...newAccount,
                          smtpHost: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Input
                      className="h-8 text-xs"
                      placeholder="465"
                      value={newAccount.smtpPort}
                      onChange={(e) =>
                        setNewAccount({
                          ...newAccount,
                          smtpPort: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">
                  账号标识
                </p>
                <div>
                  <label className="text-xs text-muted-foreground">
                    用户名
                  </label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="邮箱地址"
                    value={newAccount.username}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, username: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs flex-1"
                    onClick={() => setShowForm(false)}
                    disabled={saving}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs flex-1"
                    onClick={addAccount}
                    disabled={saving}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    保存参数
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-3 text-xs text-blue-700 flex items-start gap-2">
              <Shield className="h-4 w-4 shrink-0 mt-0.5" />
              当前版本尚未内置 IMAP/SMTP
              Worker，因此不收集邮箱密码，也不会自动收发邮件。这里保存的只是非敏感连接参数草稿。
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import { AuthScaffold } from "@/components/auth-story";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, name, email, password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "注册失败，请稍后重试");
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      router.push(result?.ok ? "/app" : "/auth/login");
    } catch {
      setError("注册服务暂时不可用，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold create>
      <div className="auth-form-heading">
        <span>开始一段新的业务旅程</span>
        <h1>创建你的工作区</h1>
        <p>为你或你的团队建立独立的业务空间。</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company">公司或工作区名称</Label>
          <Input
            id="company"
            autoComplete="organization"
            placeholder="例如：远航贸易"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            maxLength={120}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">你的姓名</Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="用于团队沟通的姓名"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">登录邮箱</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={255}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">设置密码</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="至少 12 位，包含两类字符"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            maxLength={128}
            required
            aria-describedby="registration-password-help"
          />
          <p
            id="registration-password-help"
            className="text-xs leading-5 text-muted-foreground"
          >
            使用字母、数字或符号组合，并避免过于简单的重复字符。
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs leading-5 text-destructive"
          >
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="auth-submit w-full"
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
          {loading ? "正在创建…" : "注册并进入工作区"}
          <ArrowRight className="ml-auto" />
        </Button>
      </form>
      <p className="auth-switch-link">
        已有账号？
        <Link href="/auth/login">
          返回登录 <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
      <div className="auth-form-note">
        每个注册邮箱创建独立工作区。加入已有团队，请联系该工作区的管理员。
      </div>
    </AuthScaffold>
  );
}

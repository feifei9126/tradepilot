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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.ok) {
        router.push("/app");
      } else {
        setError("登录失败，请检查邮箱和密码");
      }
    } catch {
      setError("登录服务暂时不可用，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold>
      <div className="auth-form-heading">
        <span>欢迎回来</span>
        <h1>登录你的工作区</h1>
        <p>继续跟进客户，把握下一次机会。</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">登录邮箱</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="输入你的邮箱"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={!!error}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="输入你的密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={!!error}
          />
        </div>
        {error && (
          <p
            id="login-error"
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
          {loading ? "正在验证…" : "进入工作台"}
          <ArrowRight className="ml-auto" />
        </Button>
      </form>
      <p className="auth-switch-link">
        还没有账号？
        <Link href="/auth/register">
          注册独立工作区{" "}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
      <div className="auth-form-note">
        普通用户使用注册邮箱登录。平台管理能力仅对运营者开放。
      </div>
    </AuthScaffold>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  Ship,
  UserRoundPlus,
} from "lucide-react";

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
    <main className="grid min-h-screen bg-[#f4f7fa] lg:grid-cols-[minmax(360px,42%)_1fr]">
      <section className="relative hidden overflow-hidden bg-[#17212b] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-[#2f77e5] shadow-[inset_0_0_0_1px_rgb(255_255_255/20%)]">
            <Ship className="size-5" />
          </span>
          <span>
            <strong className="block text-base">TradePilot</strong>
            <span className="mt-0.5 block text-[10px] font-semibold text-[#8194a7]">
              GLOBAL TRADE OS
            </span>
          </span>
        </Link>

        <div className="my-auto max-w-xl py-14">
          <p className="mb-3 text-xs font-semibold text-[#7fc8d4]">
            CREATE YOUR WORKSPACE
          </p>
          <h1 className="max-w-lg text-[32px] font-bold leading-[1.25]">
            从客户询盘到产品视频，创建自己的业务工作区。
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[#aebbc6]">
            注册后直接进入外贸控制台。客户、报价、履约与内容生产保持在同一条业务线上。
          </p>

          <div className="mt-9 divide-y divide-[#344250] rounded-md border border-[#344250] bg-[#202d39] px-5">
            {[
              [ServerCog, "独立工作区", "公司与账号数据按工作区关联"],
              [
                ShieldCheck,
                "密码安全存储",
                "使用 PBKDF2 加盐哈希，不保存明文密码",
              ],
              [CheckCircle2, "注册后即登录", "创建成功后直接进入业务控制台"],
            ].map(([Icon, title, description]) => {
              const ItemIcon = Icon as typeof ServerCog;
              return (
                <div key={title as string} className="flex gap-3 py-4">
                  <ItemIcon className="mt-0.5 size-4 shrink-0 text-[#78cfb1]" />
                  <div>
                    <strong className="block text-sm">{title as string}</strong>
                    <span className="mt-1 block text-[11px] leading-5 text-[#8194a7]">
                      {description as string}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-[#718397]">
          开源 · 自部署 · 数据与模型配置由你掌控
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[440px]">
          <Link
            href="/"
            className="mb-7 flex items-center gap-2 text-sm font-medium text-[#637181] hover:text-[#12202c] lg:hidden"
          >
            <ArrowLeft className="size-4" />
            返回首页
          </Link>

          <div className="mb-7">
            <span className="flex size-11 items-center justify-center rounded-md bg-blue-50 text-[#1769e0]">
              <UserRoundPlus className="size-5" />
            </span>
            <p className="mb-2 mt-5 text-xs font-semibold text-[#1769e0]">
              TEAM WORKSPACE
            </p>
            <h2 className="text-2xl font-bold text-[#12202c]">
              创建团队工作区
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#637181]">
              需要已配置的 PostgreSQL 或 Neon 数据库。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">公司名</Label>
              <Input
                id="company"
                autoComplete="organization"
                placeholder="你的外贸公司"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                autoComplete="name"
                placeholder="你的姓名"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="至少 8 个字符"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={128}
                required
              />
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
              {loading ? "正在创建" : "注册并进入工作区"}
              {!loading && <ArrowRight className="ml-auto" />}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-[#637181]">
            已有账号？{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-[#1769e0] hover:underline"
            >
              返回登录
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

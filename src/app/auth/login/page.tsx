"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  LockKeyhole,
  Ship,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@tradepilot.dev");
  const [password, setPassword] = useState("password");
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
    <main className="grid min-h-screen bg-[#f4f7fa] lg:grid-cols-[minmax(360px,42%)_1fr]">
      <section className="relative hidden overflow-hidden bg-[#17212b] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-[#2f77e5] shadow-[inset_0_0_0_1px_rgb(255_255_255/20%)]">
            <Ship className="size-5" />
          </span>
          <div>
            <strong className="block text-base">TradePilot</strong>
            <span className="mt-0.5 block text-[10px] font-semibold text-[#8194a7]">
              GLOBAL TRADE OS
            </span>
          </div>
        </div>

        <div className="my-auto max-w-xl py-16">
          <p className="mb-3 text-xs font-semibold text-[#7fc8d4]">
            CONTROL EVERY TRADE FLOW
          </p>
          <h1 className="max-w-lg text-[32px] font-bold leading-[1.25]">
            让询盘、报价、履约和产品内容保持在同一条业务线上。
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[#aebbc6]">
            一个为小型外贸团队设计的自托管业务控制台。登录后直接进入需要处理的订单、客户机会和内容生产任务。
          </p>

          <div className="mt-10 rounded-md border border-[#344250] bg-[#202d39] p-5">
            <div className="flex items-center justify-between border-b border-[#344250] pb-4">
              <div>
                <span className="block text-[10px] text-[#8194a7]">
                  业务状态
                </span>
                <strong className="mt-1.5 block text-sm">
                  演示工作区已就绪
                </strong>
              </div>
              <span className="flex items-center gap-2 text-xs font-semibold text-[#78cfb1]">
                <span className="studio-live-dot !bg-[#38b986]" />
                在线
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-4">
              <div>
                <CircleDollarSign className="size-4 text-[#7db0f4]" />
                <strong className="mt-2 block text-lg tabular-nums">
                  $31.6K
                </strong>
                <span className="mt-1 block text-[10px] text-[#8194a7]">
                  订单金额
                </span>
              </div>
              <div>
                <CheckCircle2 className="size-4 text-[#70c9ad]" />
                <strong className="mt-2 block text-lg tabular-nums">60%</strong>
                <span className="mt-1 block text-[10px] text-[#8194a7]">
                  转化率
                </span>
              </div>
              <div>
                <LockKeyhole className="size-4 text-[#f0a082]" />
                <strong className="mt-2 block text-lg">BYOK</strong>
                <span className="mt-1 block text-[10px] text-[#8194a7]">
                  模型自主
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#718397]">
          开源 · 自部署 · 数据与模型配置由你掌控
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[390px]">
          <div className="mb-9 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-white">
              <Ship className="size-[18px]" />
            </span>
            <strong>TradePilot</strong>
          </div>

          <div className="mb-7">
            <p className="page-kicker">SECURE WORKSPACE</p>
            <h2 className="text-2xl font-bold text-[#12202c]">
              登录业务控制台
            </h2>
            <p className="mt-2 text-sm text-[#637181]">
              使用部署时配置的管理员账号继续。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
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
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="size-4 shrink-0" />
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
              {loading ? "正在验证" : "安全登录"}
              {!loading && <ArrowRight className="ml-auto" />}
            </Button>
          </form>

          <div className="mt-6 border-t pt-5 text-xs leading-5 text-[#637181]">
            本地开发环境已预填演示账号。正式部署必须通过环境变量设置独立管理员密码。
          </div>
        </div>
      </section>
    </main>
  );
}

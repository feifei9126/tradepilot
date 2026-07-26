"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  ListChecks,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Ship,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DatabaseHealthResult } from "@/lib/database-health";

type HealthResponse = DatabaseHealthResult & {
  code?: string;
  message?: string;
};

async function loadHealth(): Promise<HealthResponse> {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const result = (await response.json()) as HealthResponse;
    if (!result.storage) throw new Error("Invalid health response");
    return result;
  } catch {
    return {
      status: "error",
      storage: "postgresql",
      database: "unavailable",
      migrations: "outdated",
      bootstrapRequired: true,
      code: "DATABASE_UNAVAILABLE",
      message: "无法读取部署状态。请检查 Worker 日志和数据库连接。",
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthChecking, setHealthChecking] = useState(true);

  const applyHealth = useCallback((result: HealthResponse) => {
    setHealth(result);
    if (result.storage === "memory") {
      setEmail((value) => value || "demo@tradepilot.dev");
      setPassword((value) => value || "12345678");
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setHealthChecking(true);
    try {
      applyHealth(await loadHealth());
    } finally {
      setHealthChecking(false);
    }
  }, [applyHealth]);

  useEffect(() => {
    let active = true;
    void loadHealth().then((result) => {
      if (!active) return;
      applyHealth(result);
      setHealthChecking(false);
    });
    return () => {
      active = false;
    };
  }, [applyHealth]);

  const configurationMessage =
    health?.status === "error"
      ? health.message || "数据库尚未准备完成。"
      : null;
  const storageLabel =
    health?.storage === "memory"
      ? "演示内存"
      : health?.storage === "postgresql"
        ? "PostgreSQL"
        : "待配置";
  const databaseLabel =
    health?.database === "connected"
      ? "已连接"
      : health?.database === "not_used"
        ? "无需连接"
        : "连接异常";
  const migrationLabel =
    health?.migrations === "current"
      ? "已更新"
      : health?.migrations === "not_used"
        ? "无需迁移"
        : "待执行";

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
                  {healthChecking
                    ? "正在检查部署状态"
                    : health?.status === "ok"
                      ? "业务工作区已就绪"
                      : "需要完成数据库配置"}
                </strong>
              </div>
              <span
                className={`flex items-center gap-2 text-xs font-semibold ${
                  health?.status === "ok" ? "text-[#78cfb1]" : "text-[#f0a082]"
                }`}
              >
                <span
                  className={`studio-live-dot ${
                    health?.status === "ok" ? "!bg-[#38b986]" : "!bg-[#e57d55]"
                  }`}
                />
                {health?.status === "ok" ? "在线" : "需配置"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-4">
              <div>
                <Database className="size-4 text-[#7db0f4]" />
                <strong className="mt-2 block text-sm">{storageLabel}</strong>
                <span className="mt-1 block text-[10px] text-[#8194a7]">
                  数据存储
                </span>
              </div>
              <div>
                <CheckCircle2 className="size-4 text-[#70c9ad]" />
                <strong className="mt-2 block text-sm">{databaseLabel}</strong>
                <span className="mt-1 block text-[10px] text-[#8194a7]">
                  数据库
                </span>
              </div>
              <div>
                <ListChecks className="size-4 text-[#f0a082]" />
                <strong className="mt-2 block text-sm">{migrationLabel}</strong>
                <span className="mt-1 block text-[10px] text-[#8194a7]">
                  数据结构
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
              {health?.storage === "memory"
                ? "使用本地演示账号继续。"
                : "使用数据库中的团队账号继续。"}
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

            {configurationMessage && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-md border border-[#d9a23c]/40 bg-[#fff8e8] px-3 py-3 text-sm text-[#7a5514]"
              >
                <ServerCog className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm">登录暂不可用</strong>
                  <p className="mt-1 leading-5">{configurationMessage}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void checkHealth()}
                  disabled={healthChecking}
                  aria-label="重新检查部署状态"
                  title="重新检查部署状态"
                >
                  <RefreshCw className={healthChecking ? "animate-spin" : ""} />
                </Button>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || healthChecking || health?.status !== "ok"}
            >
              {loading || healthChecking ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LockKeyhole />
              )}
              {loading
                ? "正在验证"
                : healthChecking
                  ? "正在检查部署"
                  : "安全登录"}
              {!loading && <ArrowRight className="ml-auto" />}
            </Button>
          </form>

          {health?.storage === "postgresql" && health.status === "ok" && (
            <p className="mt-5 text-center text-sm text-[#637181]">
              需要团队账号？{" "}
              <Link
                href="/auth/register"
                className="font-semibold text-[#1769e0] hover:underline"
              >
                创建工作区
              </Link>
            </p>
          )}

          <div className="mt-6 border-t pt-5 text-xs leading-5 text-[#637181]">
            <span className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              {health?.storage === "memory"
                ? "本地演示数据只保存在当前进程中，重启后会恢复。"
                : "生产账号与业务数据均从 PostgreSQL 读取。"}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

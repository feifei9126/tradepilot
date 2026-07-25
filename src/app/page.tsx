"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Bot,
  Boxes,
  Check,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Film,
  Globe,
  Menu,
  PackageCheck,
  ShieldCheck,
  Ship,
  Smartphone,
  Users,
  X,
} from "lucide-react";

import { LocalQrCode } from "@/components/local-qr-code";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { motionTokens } from "@/lib/motion";

const capabilities = [
  {
    icon: Users,
    titleKey: "landing.feature.customer",
    descKey: "landing.feature.customer.desc",
    tone: "bg-blue-50 text-blue-700",
  },
  {
    icon: FileText,
    titleKey: "landing.feature.quote",
    descKey: "landing.feature.quote.desc",
    tone: "bg-violet-50 text-violet-700",
  },
  {
    icon: ClipboardList,
    titleKey: "landing.feature.order",
    descKey: "landing.feature.order.desc",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: PackageCheck,
    titleKey: "landing.feature.ship",
    descKey: "landing.feature.ship.desc",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    icon: Bot,
    titleKey: "landing.feature.ai",
    descKey: "landing.feature.ai.desc",
    tone: "bg-cyan-50 text-cyan-700",
  },
  {
    icon: Film,
    title: "产品视频生产",
    titleEn: "Product video production",
    desc: "从产品素材采集到短视频生成，任务与成片集中管理。",
    descEn: "Manage collection, rendering tasks, and deliverables in one flow.",
    tone: "bg-orange-50 text-orange-700",
  },
];

const providers = ["DeepSeek", "通义千问", "OpenAI", "Ollama 本地"];
const providersEn = ["DeepSeek", "Tongyi Qwen", "OpenAI", "Ollama Local"];

export default function LandingPage() {
  const { t, locale, setLocale } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");

  useEffect(() => {
    const host = window.location.host;
    if (!host.startsWith("localhost") && !host.startsWith("127.")) {
      const timer = window.setTimeout(
        () => setDownloadUrl(`${window.location.origin}/download`),
        0,
      );
      return () => window.clearTimeout(timer);
    }

    fetch("/api/network")
      .then((response) => response.json())
      .then((data) =>
        setDownloadUrl(`${data.urls?.lan || window.location.origin}/download`),
      )
      .catch(() => setDownloadUrl(`${window.location.origin}/download`));
  }, []);

  const providerList = locale === "zh" ? providers : providersEn;
  const isChinese = locale === "zh";

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-[#12202c]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/15 bg-[#17212b]/95 text-white backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="TradePilot 首页"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-[#2f77e5] shadow-[inset_0_0_0_1px_rgb(255_255_255/20%)]">
              <Ship className="size-[18px]" />
            </span>
            <span>
              <strong className="block text-sm">TradePilot</strong>
              <span className="block text-[9px] font-semibold text-[#91a5b8]">
                GLOBAL TRADE OS
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="官网导航"
          >
            <Button
              variant="ghost"
              size="sm"
              className="!border-transparent text-[#c7d1db] hover:bg-white/10 hover:text-white"
              onClick={() => scrollToSection("operations")}
            >
              业务能力
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="!border-transparent text-[#c7d1db] hover:bg-white/10 hover:text-white"
              onClick={() => scrollToSection("studio")}
            >
              视频生产
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="!border-transparent text-[#c7d1db] hover:bg-white/10 hover:text-white"
              onClick={() => scrollToSection("deployment")}
            >
              自托管
            </Button>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Select
              value={locale}
              items={{ zh: "中文", en: "English" }}
              onValueChange={(value) =>
                value && setLocale(value as "zh" | "en")
              }
            >
              <SelectTrigger className="h-9 w-28 !border-white/20 !bg-white/5 !text-white hover:!bg-white/10">
                <Globe className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <Button
              render={<Link href="/auth/login" />}
              nativeButton={false}
              variant="ghost"
              className="!border-transparent text-white hover:bg-white/10 hover:text-white"
            >
              {t("landing.nav.login")}
            </Button>
            <Button render={<Link href="/auth/login" />} nativeButton={false}>
              {t("landing.nav.start")}
              <ArrowRight />
            </Button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Select
              value={locale}
              items={{ zh: "中", en: "EN" }}
              onValueChange={(value) =>
                value && setLocale(value as "zh" | "en")
              }
            >
              <SelectTrigger className="h-9 w-20 !border-white/20 !bg-white/5 !text-white">
                <Globe className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">EN</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="!border-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "关闭导航" : "打开导航"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: motionTokens.duration.fast }}
              className="border-t border-white/15 bg-[#17212b] px-4 py-4 md:hidden"
              aria-label="移动端官网导航"
            >
              <div className="grid gap-2">
                <Button
                  variant="ghost"
                  className="justify-start text-white"
                  onClick={() => scrollToSection("operations")}
                >
                  业务能力
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start text-white"
                  onClick={() => scrollToSection("studio")}
                >
                  视频生产
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start text-white"
                  onClick={() => scrollToSection("deployment")}
                >
                  自托管
                </Button>
                <Button
                  render={<Link href="/auth/login" />}
                  nativeButton={false}
                  className="mt-2"
                >
                  {t("landing.nav.start")}
                  <ArrowRight />
                </Button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main>
        <section className="relative flex min-h-[calc(100svh-48px)] items-center overflow-hidden px-4 pb-12 pt-28 text-white sm:px-6">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/tradepilot-console.png')" }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[#101b26]/85"
            aria-hidden="true"
          />

          <div className="relative mx-auto w-full max-w-7xl">
            <div className="max-w-3xl">
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-[#83cbd5]">
                <span className="studio-live-dot" />
                GLOBAL OPERATIONS · SELF HOSTED
              </p>
              <h1 className="text-5xl font-bold leading-none sm:text-6xl">
                TradePilot
              </h1>
              <h2 className="mt-5 max-w-2xl text-2xl font-semibold leading-tight sm:text-4xl">
                {isChinese
                  ? "外贸业务、履约与产品内容的统一控制台"
                  : "One control system for trade, fulfillment, and product content"}
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[#c5d0da] sm:text-base">
                {isChinese
                  ? "把客户、询盘、报价、订单、出货和产品视频放回同一条业务线上，让小团队先看到异常，再处理日常工作。"
                  : "Keep customers, quotations, orders, shipments, and product video on one operational line, with exceptions visible first."}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  render={<Link href="/auth/login" />}
                  nativeButton={false}
                  size="lg"
                  className="h-11 px-5"
                >
                  {t("landing.hero.cta")}
                  <ArrowRight />
                </Button>
                <Button
                  render={<Link href="/app" />}
                  nativeButton={false}
                  size="lg"
                  variant="outline"
                  className="h-11 border-white/35 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
                >
                  {t("landing.hero.demo")}
                </Button>
              </div>

              <div className="mt-10 hidden max-w-2xl grid-cols-3 border-y border-white/20 py-4 sm:grid">
                {[
                  ["31.6K", isChinese ? "演示订单金额" : "Demo order value"],
                  ["60%", isChinese ? "询盘转化率" : "Inquiry conversion"],
                  ["BYOK", isChinese ? "模型自主配置" : "Model ownership"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="border-r border-white/20 px-4 first:pl-0 last:border-r-0"
                  >
                    <strong className="block text-xl tabular-nums">
                      {value}
                    </strong>
                    <span className="mt-1 block text-[11px] text-[#9eafbe]">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="operations"
          className="scroll-mt-16 border-b border-[#dce3ea] bg-white px-4 py-20 sm:px-6"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-2xl">
              <p className="mb-2 text-xs font-semibold text-[#1769e0]">
                OPERATIONS / ONE FLOW
              </p>
              <h2 className="text-3xl font-bold">
                {isChinese
                  ? "日常业务保持明亮、紧凑、可扫描"
                  : "Bright, compact, and scannable daily operations"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#637181]">
                {t("landing.features.desc")}
              </p>
            </div>

            <div className="grid overflow-hidden rounded-lg border border-[#dce3ea] md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((capability) => {
                const Icon = capability.icon;
                return (
                  <article
                    key={capability.titleKey || capability.title}
                    className="border-b border-[#dce3ea] p-6 md:border-r lg:min-h-48"
                  >
                    <span
                      className={`flex size-10 items-center justify-center rounded-md ${capability.tone}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-5 text-base font-semibold">
                      {capability.titleKey
                        ? t(capability.titleKey)
                        : isChinese
                          ? capability.title
                          : capability.titleEn}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#637181]">
                      {capability.descKey
                        ? t(capability.descKey)
                        : isChinese
                          ? capability.desc
                          : capability.descEn}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="studio"
          className="scroll-mt-16 bg-[#17212b] px-4 py-20 text-white sm:px-6"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#83cbd5]">
                <span className="size-2 rounded-full bg-[#e85b32]" />
                GROWTH STUDIO
              </p>
              <h2 className="max-w-xl text-3xl font-bold leading-tight">
                {isChinese
                  ? "产品素材进入，销售视频交付"
                  : "Product material in, sales video delivered"}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#aebbc6]">
                {isChinese
                  ? "Firecrawl 采集产品素材，MoneyPrinterTurbo 与 OpenMontage 承接自动成片和高级制作，任务状态与交付集中可见。"
                  : "Collect product material with Firecrawl and route rendering through MoneyPrinterTurbo or OpenMontage with visible delivery states."}
              </p>
              <Button
                render={<Link href="/app/product-video" />}
                nativeButton={false}
                className="mt-7 bg-[#e85b32] text-white hover:bg-[#d94f29]"
              >
                {isChinese ? "进入产品视频" : "Open product video"}
                <ArrowRight />
              </Button>
            </div>

            <div className="rounded-lg border border-[#43505d] bg-[#1d2935] p-5 sm:p-7">
              <div className="flex items-center justify-between border-b border-[#43505d] pb-4">
                <div>
                  <span className="text-[10px] text-[#8194a7]">
                    CURRENT PIPELINE
                  </span>
                  <strong className="mt-1 block text-sm">
                    {isChinese
                      ? "产品内容生产链路"
                      : "Product content pipeline"}
                  </strong>
                </div>
                <span className="flex items-center gap-2 text-xs font-semibold text-[#78cfb1]">
                  <span className="studio-live-dot !bg-[#38b986]" />
                  {isChinese ? "引擎在线" : "Engine online"}
                </span>
              </div>

              <div className="relative mt-7 grid grid-cols-4 gap-2">
                <div className="absolute left-[12.5%] right-[12.5%] top-4 h-px bg-[#43505d]" />
                <motion.div
                  className="absolute left-[12.5%] top-4 h-px origin-left bg-[#e85b32]"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 0.68 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{
                    duration: motionTokens.duration.slow,
                    ease: motionTokens.easing.smooth,
                  }}
                  style={{ width: "75%" }}
                />
                {[
                  [Boxes, isChinese ? "素材采集" : "Collect", "complete"],
                  [FileText, isChinese ? "内容配置" : "Configure", "complete"],
                  [Bot, isChinese ? "引擎生成" : "Generate", "active"],
                  [Film, isChinese ? "成片交付" : "Deliver", "pending"],
                ].map(([Icon, label, status]) => {
                  const PipelineIcon = Icon as typeof Boxes;
                  return (
                    <div
                      key={label as string}
                      className="relative z-10 text-center"
                    >
                      <span
                        className={`mx-auto flex size-8 items-center justify-center rounded-full border ${status === "complete" ? "border-[#38b986] bg-[#203d38] text-[#78cfb1]" : status === "active" ? "border-[#f28a67] bg-[#e85b32] text-white" : "border-[#5b6875] bg-[#263440] text-[#8194a7]"}`}
                      >
                        {status === "complete" ? (
                          <Check className="size-4" />
                        ) : (
                          <PipelineIcon className="size-4" />
                        )}
                      </span>
                      <span className="mt-3 block text-[11px] font-semibold text-[#d5dde5]">
                        {label as string}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section
          id="deployment"
          className="scroll-mt-16 border-b border-[#dce3ea] bg-white px-4 py-20 sm:px-6"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-2 text-xs font-semibold text-[#12805c]">
                BYOK / SELF HOSTED
              </p>
              <h2 className="max-w-2xl text-3xl font-bold">
                {t("landing.byok.title")}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#637181]">
                {t("landing.byok.desc")}
              </p>

              <div className="mt-8 grid max-w-2xl grid-cols-2 overflow-hidden rounded-lg border border-[#dce3ea] sm:grid-cols-4">
                {providerList.map((provider) => (
                  <div
                    key={provider}
                    className="flex min-h-20 items-center justify-center border-b border-r border-[#dce3ea] px-3 text-center text-sm font-semibold last:border-r-0"
                  >
                    {provider}
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-[#4e5d6b]">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#12805c]" />
                  {isChinese ? "密钥由使用者配置" : "User-configured keys"}
                </span>
                <span className="flex items-center gap-2">
                  <CircleDollarSign className="size-4 text-[#1769e0]" />
                  {isChinese ? "模型费用独立结算" : "Independent model billing"}
                </span>
                <span className="flex items-center gap-2">
                  <Globe className="size-4 text-[#b75c13]" />
                  {isChinese ? "支持本地服务地址" : "Local endpoints supported"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-[#dce3ea] bg-[#f4f7fa] p-7">
              <div className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#17212b] text-white">
                  <Smartphone className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">
                    {isChinese
                      ? "同一部署，桌面与手机访问"
                      : "One deployment for desktop and mobile"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#637181]">
                    {isChinese
                      ? "响应式后台通过同一个地址访问，也可以添加到手机主屏幕。"
                      : "Use the same responsive workspace URL on desktop or mobile."}
                  </p>
                </div>
              </div>
              <div className="mt-7 border-t border-[#dce3ea] pt-7 text-center">
                {downloadUrl ? (
                  <LocalQrCode
                    value={downloadUrl}
                    alt="打开 TradePilot 移动入口"
                    className="mx-auto size-36 bg-white"
                  />
                ) : (
                  <div className="mx-auto flex size-36 items-center justify-center border border-[#dce3ea] bg-white text-xs text-[#637181]">
                    生成二维码...
                  </div>
                )}
                <p className="mt-4 text-xs font-semibold text-[#4e5d6b]">
                  {isChinese ? "扫描当前部署地址" : "Scan this deployment URL"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#eaf2fd] px-4 py-16 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">{t("landing.cta.title")}</h2>
              <p className="mt-2 text-sm text-[#637181]">
                {t("landing.cta.desc")}
              </p>
            </div>
            <Button
              render={<Link href="/auth/login" />}
              nativeButton={false}
              size="lg"
              className="md:shrink-0"
            >
              {t("landing.hero.cta")}
              <ArrowRight />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#2f3c49] bg-[#17212b] px-4 py-8 text-[#9eafbe] sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-white">
            <Ship className="size-4" />
            <strong>TradePilot</strong>
          </div>
          <p>{t("landing.footer")}</p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/feifei9126/tradepilot"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              GitHub
            </a>
            <a
              href="https://github.com/feifei9126/tradepilot#readme"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              {isChinese ? "使用文档" : "Docs"}
            </a>
            <a
              href="https://github.com/feifei9126/tradepilot/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              License
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

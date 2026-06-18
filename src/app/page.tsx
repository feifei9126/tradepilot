"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Ship, Users, FileText, ClipboardList, Brain, CheckCircle, ArrowRight, Menu, X,
  Globe, Smartphone, QrCode, Bell, Bot, MessageSquare, Quote, Star, Shield,
  Sparkles, Zap, Layers, BarChart3, ChevronRight, ExternalLink, Clock, DollarSign
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const features = [
  { icon: Brain, titleKey: "landing.feature.ai", descKey: "landing.feature.ai.desc", color: "from-violet-500 to-violet-600", lightBg: "bg-violet-50" },
  { icon: FileText, titleKey: "landing.feature.quote", descKey: "landing.feature.quote.desc", color: "from-blue-500 to-blue-600", lightBg: "bg-blue-50" },
  { icon: ClipboardList, titleKey: "landing.feature.order", descKey: "landing.feature.order.desc", color: "from-emerald-500 to-emerald-600", lightBg: "bg-emerald-50" },
  { icon: Users, titleKey: "landing.feature.customer", descKey: "landing.feature.customer.desc", color: "from-amber-500 to-amber-600", lightBg: "bg-amber-50" },
  { icon: CheckCircle, titleKey: "landing.feature.doc", descKey: "landing.feature.doc.desc", color: "from-rose-500 to-rose-600", lightBg: "bg-rose-50" },
  { icon: Ship, titleKey: "landing.feature.ship", descKey: "landing.feature.ship.desc", color: "from-cyan-500 to-cyan-600", lightBg: "bg-cyan-50" },
];

const steps = [
  { num: "1", titleKey: "landing.step1.title", descKey: "landing.step1.desc" },
  { num: "2", titleKey: "landing.step2.title", descKey: "landing.step2.desc" },
  { num: "3", titleKey: "landing.step3.title", descKey: "landing.step3.desc" },
];

const providers = ["DeepSeek", "通义千问", "OpenAI", "Ollama 本地"];
const providersEn = ["DeepSeek", "Tongyi Qwen", "OpenAI", "Ollama Local"];

const testimonials = [
  { quote: "以前跟单靠微信追问，现在 TradePilot 自动提醒交期，AI 回复客户消息，一个人也能管 20 个订单。", author: "张经理", role: "深圳××电子科技", rating: 5 },
  { quote: "API Key 自己管的模式太好了，用 DeepSeek 一个月 AI 成本不到 20 块，功能不比那些年费几千的差。", author: "李总", role: "广州××贸易有限公司", rating: 5 },
];

export default function LandingPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lanIp, setLanIp] = useState("");

  useEffect(() => {
    const host = window.location.host;
    if (!host.startsWith("localhost") && !host.startsWith("127.")) {
      setLanIp(host);
    } else {
      fetch("/api/network").then(r => r.json()).then(d => {
        if (d.lanIp && d.lanIp !== "localhost") setLanIp(d.lanIp);
      }).catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const providerList = locale === "zh" ? providers : providersEn;

  return (
    <div className="min-h-screen bg-white">
      {/* ===== NAV ===== */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "bg-white/80 backdrop-blur-lg border-b shadow-sm" : "bg-transparent"
      )}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
              <Ship className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">TradePilot</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {["功能", "AI", "价格"].map((item) => (
              <Button key={item} variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground">
                {item}
              </Button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Select value={locale} onValueChange={(v) => v && setLocale(v as "zh" | "en")}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <Globe className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => router.push("/auth/login")}>{t("landing.nav.login")}</Button>
            <Button size="sm" className="h-8 shadow-sm" onClick={() => router.push("/auth/login")}>
              {t("landing.nav.start")} <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <Select value={locale} onValueChange={(v) => v && setLocale(v as "zh" | "en")}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <Globe className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">EN</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t p-4 space-y-2 md:hidden bg-white/95 backdrop-blur-lg">
            <Button className="w-full" variant="outline" onClick={() => router.push("/auth/login")}>{t("landing.nav.login")}</Button>
            <Button className="w-full" onClick={() => router.push("/auth/login")}>{t("landing.nav.start")}</Button>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-violet-100/50 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border bg-white/80 backdrop-blur-sm px-3 py-1 text-sm text-muted-foreground shadow-sm mb-6">
            <Brain className="h-3.5 w-3.5 text-primary" />
            {t("landing.badge")}
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
            <span className="text-gray-900">{t("landing.hero.title1")}</span>
            <span className="block mt-2 bg-gradient-to-r from-primary via-primary/80 to-violet-500 bg-clip-text text-transparent">
              {t("landing.hero.title2")}
            </span>
          </h1>

          <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            {t("landing.hero.desc")}
          </p>

          <div className="flex items-center justify-center gap-3 mt-10">
            <Button size="lg" className="text-base h-12 px-8 shadow-lg shadow-primary/20" onClick={() => router.push("/auth/login")}>
              {t("landing.hero.cta")} <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
            <Button size="lg" variant="outline" className="text-base h-12 px-8" onClick={() => router.push("/app")}>
              {t("landing.hero.demo")}
            </Button>
          </div>

          <p className="text-sm text-gray-400 mt-4 flex items-center justify-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />{t("landing.hero.tagline")}
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-16 pt-8 border-t">
            {[
              { value: "50+", label: "预置产品" },
              { value: "6", label: "AI 能力" },
              { value: "0", label: "月费零元" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-24 px-4 bg-gray-50/50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary font-medium mb-4">
              <Zap className="h-3.5 w-3.5" /> 核心功能
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">{t("landing.features.title")}</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">{t("landing.features.desc")}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.titleKey} className="group bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform", f.lightBg)}>
                    <Icon className="h-5 w-5" style={{ color: f.color.includes("violet") ? "#7c3aed" : f.color.includes("blue") ? "#2563eb" : f.color.includes("emerald") ? "#059669" : f.color.includes("amber") ? "#d97706" : f.color.includes("rose") ? "#e11d48" : "#06b6d4" }} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{t(f.titleKey)}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{t(f.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald/10 px-3 py-1 text-sm text-emerald-600 font-medium mb-4 bg-emerald-50">
              <Clock className="h-3.5 w-3.5" /> 快速上手
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">{t("landing.steps.title")}</h2>
            <p className="text-gray-500 mt-3">{t("landing.steps.desc")}</p>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute left-1/2 top-16 bottom-16 w-px bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />

            {steps.map((s, i) => (
              <div key={s.num} className={cn("relative flex items-center gap-8 mb-12 last:mb-0", i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse")}>
                <div className="hidden md:block flex-1 text-center">
                  <div className={cn(
                    "inline-block text-left max-w-xs space-y-2",
                    i % 2 === 0 ? "text-right" : "text-left"
                  )}>
                    <h3 className="font-semibold text-gray-900 text-lg">{t(s.titleKey)}</h3>
                    <p className="text-sm text-gray-500">{t(s.descKey)}</p>
                  </div>
                </div>

                <div className="relative flex items-center justify-center shrink-0">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/70 text-white font-bold text-lg flex items-center justify-center shadow-lg shadow-primary/20">
                    {s.num}
                  </div>
                </div>

                {/* Mobile text */}
                <div className="md:hidden flex-1">
                  <h3 className="font-semibold text-gray-900">{t(s.titleKey)}</h3>
                  <p className="text-sm text-gray-500 mt-1">{t(s.descKey)}</p>
                </div>

                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI BYOK ===== */}
      <section className="py-24 px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-sm text-gray-300 mb-4">
            <Sparkles className="h-3.5 w-3.5" /> {t("landing.byok.badge")}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold">{t("landing.byok.title")}</h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">{t("landing.byok.desc")}</p>

          <div className="flex justify-center gap-4 mt-10 flex-wrap">
            {providerList.map((name, i) => (
              <div key={name} className={cn(
                "rounded-xl border px-5 py-3 text-sm transition-all duration-200 hover:-translate-y-1",
                "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
              )}>
                <p className="font-medium">{name}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[
              { icon: DollarSign, label: "零月费", desc: "只用你的 API Key" },
              { icon: Shield, label: "数据私有", desc: "Key & 数据本地加密" },
              { icon: Zap, label: "自由切换", desc: "模型随时换" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-2">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MOBILE APP ===== */}
      <section className="py-24 px-4 bg-gray-50/50">
        <div className="mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary font-medium mb-4">
                <Smartphone className="h-4 w-4 mr-1" /> 移动端
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">手机 App 同步管理</h2>
              <p className="text-gray-500 mt-3 leading-relaxed">随时随地接收客户消息，AI 自动回复，扫码绑定 WhatsApp/微信。</p>
              <div className="mt-6 space-y-4">
                {[
                  { icon: MessageSquare, text: "消息实时同步 — 手机与 Web 端一致" },
                  { icon: Bot, text: "AI 自动回复 — 收到消息自动生成回复并发出" },
                  { icon: QrCode, text: "扫码绑定 — 绑定 WhatsApp/微信账号" },
                  { icon: Bell, text: "推送通知 — 新消息即时提醒" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 w-10 h-10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-center">
              <div className="inline-block bg-white rounded-2xl shadow-lg border p-8">
                <img src={"https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=" + encodeURIComponent(lanIp ? "http://" + lanIp + ":3456/download" : (typeof window !== "undefined" ? window.location.origin + "/download" : "http://192.168.0.101:3456/download"))}
                  alt="下载 TradePilot App" className="mx-auto w-40 h-40" />
                <p className="text-sm font-medium text-gray-900 mt-4">扫码下载手机 App</p>
                <p className="text-xs text-muted-foreground mt-1">支持 Android / iOS</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-24 px-4 bg-gray-50/30">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1 text-sm text-amber-600 font-medium mb-4 bg-amber-50">
              <Quote className="h-3.5 w-3.5" /> 用户反馈
            </div>
            <h2 className="text-3xl font-bold text-gray-900">外贸人怎么说</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                    {t.author[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.author}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-2xl text-center">
          <div className="bg-gradient-to-br from-primary/5 via-white to-violet-50 rounded-2xl border p-12">
            <h2 className="text-3xl font-bold text-gray-900">{t("landing.cta.title")}</h2>
            <p className="text-gray-500 mt-3 mb-8">{t("landing.cta.desc")}</p>
            <Button size="lg" className="text-base h-12 px-8 shadow-lg shadow-primary/20" onClick={() => router.push("/auth/login")}>
              {t("landing.hero.cta")} <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t py-10 px-4 bg-gray-50/50">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Ship className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm text-gray-600">TradePilot</span>
            </div>
            <p className="text-sm text-gray-400">{t("landing.footer")}</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <a href="#" className="hover:text-gray-600">GitHub</a>
              <a href="#" className="hover:text-gray-600">文档</a>
              <a href="#" className="hover:text-gray-600">隐私</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

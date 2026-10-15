"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Compass,
  FileText,
  Globe2,
  Menu,
  Radar,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { TradePilotBrand } from "@/components/tradepilot-brand";
import { useTranslation } from "@/lib/i18n";
import { motionTokens } from "@/lib/motion";
import "./landing.css";

const workflow = [
  {
    icon: Radar,
    title: "发现潜在客户",
    en: "Find your next customer",
    detail: "公开网页搜索 · 自动登记与初筛",
    enDetail: "Public search, capture and qualification",
  },
  {
    icon: Sparkles,
    title: "写出有针对性的沟通",
    en: "Make every conversation count",
    detail: "业务画像 · 营销与回复草稿",
    enDetail: "Business context and tailored drafts",
  },
  {
    icon: FileText,
    title: "把机会推进到交付",
    en: "Take opportunities to delivery",
    detail: "客户跟进 · 报价 · 订单履约",
    enDetail: "CRM, quotations and fulfillment",
  },
];

const capabilities = [
  {
    number: "01",
    icon: Radar,
    title: "AI 获客",
    en: "AI prospecting",
    description: "先找到值得沟通的人。",
    enDescription: "Start with people worth talking to.",
    points: [
      "公开网页搜索与来源核实",
      "去重、评分与意向筛选",
      "确认后转入客户库",
    ],
    enPoints: [
      "Public search and source verification",
      "Deduplication and qualification",
      "Move verified leads into your CRM",
    ],
    href: "/app/prospecting",
    className: "capability-prospecting",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "AI 营销",
    en: "AI marketing",
    description: "让表达更贴合每一位买家。",
    enDescription: "Find the right words for each buyer.",
    points: ["结合业务人设生成文案", "邮件与联系话术草稿", "人工确认后再触达"],
    enPoints: [
      "Copy grounded in your business",
      "Email and outreach drafts",
      "Review before reaching out",
    ],
    href: "/app/leads",
    className: "capability-marketing",
  },
  {
    number: "03",
    icon: FileText,
    title: "客户与订单",
    en: "CRM & fulfillment",
    description: "让商机有记录，跟进有下一步。",
    enDescription: "Give every opportunity a next step.",
    points: ["客户、询盘与跟进记录", "报价转订单，追踪交期", "出货与单证草稿"],
    enPoints: [
      "Customers, inquiries and follow-ups",
      "Quote-to-order and deadlines",
      "Shipments and document drafts",
    ],
    href: "/app/contacts",
    className: "capability-crm",
  },
];

export default function LandingPage() {
  const { locale, setLocale } = useTranslation();
  const zh = locale === "zh";
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const text = (chinese: string, english: string) => (zh ? chinese : english);
  const navigation = [
    { href: "#workflow", label: text("业务路径", "Your workflow") },
    { href: "#capabilities", label: text("核心能力", "Capabilities") },
    { href: "/download", label: text("桌面入口", "Desktop access") },
  ];

  return (
    <div className="trade-landing" lang={zh ? "zh-CN" : "en"}>
      <a className="skip-link" href="#landing-main">
        {text("跳到主要内容", "Skip to main content")}
      </a>
      <main id="landing-main">
        <section className="voyage-hero" aria-labelledby="hero-title">
          <Image
            src="/images/trade-harbor.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="voyage-photo"
            aria-hidden="true"
          />
          <div className="voyage-shade" aria-hidden="true" />
          <div className="voyage-grain" aria-hidden="true" />
          <header className="voyage-navigation">
            <Link
              href="/"
              aria-label="TradePilot 首页"
              className="landing-brand-link"
            >
              <TradePilotBrand />
            </Link>
            <nav
              className="voyage-nav-links"
              aria-label={text("官网导航", "Main navigation")}
            >
              {navigation.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="voyage-nav-actions">
              <button
                className="language-switch"
                type="button"
                onClick={() => setLocale(zh ? "en" : "zh")}
                aria-label={text("切换为英文", "Switch to Chinese")}
              >
                <Globe2 className="size-3.5" aria-hidden="true" />
                {zh ? "EN" : "中文"}
              </button>
              <Link href="/auth/login" className="nav-login">
                {text("进入工作台", "Sign in")}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
              <button
                className="voyage-menu-toggle"
                type="button"
                aria-expanded={menuOpen}
                aria-controls="voyage-mobile-nav"
                aria-label={
                  menuOpen
                    ? text("关闭菜单", "Close menu")
                    : text("打开菜单", "Open menu")
                }
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </header>
          {menuOpen && (
            <nav
              id="voyage-mobile-nav"
              className="voyage-mobile-nav"
              aria-label={text("移动端官网导航", "Mobile navigation")}
            >
              {navigation.map((item) => (
                <a
                  href={item.href}
                  key={item.href}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              ))}
            </nav>
          )}

          <div className="voyage-content">
            <div className="voyage-caption">
              <span className="voyage-status-dot" />
              {text(
                "为小型外贸团队而设计",
                "Built for small international trade teams",
              )}
              <span className="voyage-caption-divider" />
              AI · CRM · TRADE
            </div>
            <div className="voyage-intro">
              <h1 id="hero-title" className="voyage-enter">
                {text("让每一次发现，", "Discover the right people.")}
                <br />
                {text("走向下一笔生意。", "Move business forward.")}
              </h1>
              <div className="voyage-pitch voyage-enter">
                <p>
                  {text(
                    "从发现潜在客户，到写好第一封邮件，再到报价与交付。把 AI 获客、营销和外贸业务，放进同一个工作台。",
                    "From finding prospects to writing your first email, quoting and delivery. Connect AI prospecting, marketing and trade in one workspace.",
                  )}
                </p>
                <Link href="/auth/register" className="voyage-cta">
                  {text("创建我的工作区", "Create your workspace")}
                  <span>
                    <ArrowRight className="size-5" aria-hidden="true" />
                  </span>
                </Link>
                <span className="voyage-cta-note">
                  {text("已有账号？", "Already have an account?")}{" "}
                  <Link href="/auth/login">{text("直接登录", "Sign in")}</Link>
                </span>
              </div>
            </div>
            <div className="voyage-wordmark" aria-hidden="true">
              TradePilot<span>✦</span>
            </div>
            <div className="voyage-bottom">
              <span>
                {text(
                  "更少切换，更专注于生意。",
                  "Less switching. More meaningful work.",
                )}
              </span>
              <a href="#workflow">
                {text("探索工作流", "Explore the workflow")}
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section
          className="voyage-about"
          id="workflow"
          aria-labelledby="workflow-title"
        >
          <div className="about-heading">
            <Compass
              className="about-compass"
              strokeWidth={1}
              aria-hidden="true"
            />
            <h2 id="workflow-title">
              {text("好生意，从一次", "Good business starts with")}
              <br />
              <em>{text("有方向的发现", "a sense of direction")}</em>
              {text("开始。", ".")}
            </h2>
            <p>
              {text(
                "发现、表达、跟进，每一步都彼此连接。AI 帮你整理线索和准备沟通，你决定下一步怎么走。",
                "Connect discovery, communication and follow-up. AI helps organize leads and prepare conversations. You decide what comes next.",
              )}
            </p>
          </div>
          <ol className="voyage-workflow">
            {workflow.map((step, index) => (
              <li key={step.title}>
                <span className="workflow-sequence">0{index + 1}</span>
                <step.icon className="workflow-icon" aria-hidden="true" />
                <h3>{text(step.title, step.en)}</h3>
                <p>{text(step.detail, step.enDetail)}</p>
                {index < workflow.length - 1 && (
                  <ArrowRight className="workflow-arrow" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
          <div className="voyage-principles">
            <span>
              <ShieldCheck aria-hidden="true" />
              {text("工作区数据隔离", "Workspace isolation")}
            </span>
            <span>
              <CheckCheck aria-hidden="true" />
              {text("沟通草稿由你确认", "You review the drafts")}
            </span>
            <span>
              <Globe2 aria-hidden="true" />
              {text("使用自己的 AI Key", "Bring your own AI key")}
            </span>
          </div>
        </section>

        <section
          className="voyage-capabilities"
          id="capabilities"
          aria-labelledby="capabilities-title"
        >
          <div className="capabilities-heading">
            <div>
              <span className="section-note">
                {text(
                  "一个工作台，连接整个业务过程",
                  "One workspace. A connected business.",
                )}
              </span>
              <h2 id="capabilities-title">
                {text("从第一条线索，", "From the first lead,")}
                <br />
                <span>{text("到每一次可靠交付。", "to every delivery.")}</span>
              </h2>
            </div>
            <p>
              {text(
                "按照你的工作方式组织工具。先找到机会，再把机会变成可追踪的客户、报价和订单。",
                "Tools organized around the way you work. Find opportunities, then turn them into customers, quotations and orders you can track.",
              )}
            </p>
          </div>
          <div className="capability-grid">
            {capabilities.map((capability) => (
              <motion.article
                key={capability.number}
                className={`capability-card ${capability.className}`}
                initial={false}
                whileHover={
                  reduceMotion ? undefined : { y: -motionTokens.distance.xs }
                }
                transition={{
                  duration: motionTokens.duration.fast,
                  ease: motionTokens.easing.smooth,
                }}
              >
                <div className="capability-top">
                  <capability.icon strokeWidth={1.5} aria-hidden="true" />
                  <span>{capability.number}</span>
                </div>
                <h3>{text(capability.title, capability.en)}</h3>
                <p className="capability-description">
                  {text(capability.description, capability.enDescription)}
                </p>
                <ul>
                  {(zh ? capability.points : capability.enPoints).map(
                    (point) => (
                      <li key={point}>
                        <Check className="size-3.5" aria-hidden="true" />
                        {point}
                      </li>
                    ),
                  )}
                </ul>
                <Link href={capability.href}>
                  {text("打开", "Open")} {text(capability.title, capability.en)}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </motion.article>
            ))}
            <article className="capability-media">
              <Image
                src="/images/trade-harbor.jpg"
                alt=""
                fill
                sizes="(min-width: 1100px) 22vw, (min-width: 700px) 45vw, 90vw"
                aria-hidden="true"
              />
              <div className="capability-media-content">
                <span>{text("让产品被看见", "Bring products to life")}</span>
                <h3>
                  {text("产品内容，", "Product stories,")}
                  <br />
                  <em>{text("准备出发。", "ready to travel.")}</em>
                </h3>
                <p>
                  {text(
                    "产品资料、素材与视频任务集中管理。",
                    "Keep product information, assets and video tasks together.",
                  )}
                </p>
                <Link href="/app/product-video">
                  {text("进入产品视频", "Open product video")}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </article>
          </div>
          <div className="voyage-join">
            <div>
              <h3>
                {text(
                  "下一段增长，从这里起航。",
                  "Your next chapter starts here.",
                )}
              </h3>
              <p>
                {text(
                  "创建独立工作区，用你的业务定义 AI。",
                  "Create a workspace. Give AI your business context.",
                )}
              </p>
            </div>
            <Link href="/auth/register" className="voyage-cta">
              {text("开始使用 TradePilot", "Start with TradePilot")}
              <span>
                <ArrowRight className="size-5" aria-hidden="true" />
              </span>
            </Link>
          </div>
          <footer className="voyage-footer">
            <Link href="/" className="landing-brand-link">
              <TradePilotBrand compact />
            </Link>
            <p>
              {text(
                "AI 辅助发现与表达，决策由你掌握。",
                "AI supports discovery and communication. You stay in control.",
              )}
            </p>
            <a
              href="https://github.com/feifei9126/tradepilot"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
            <span>© {new Date().getFullYear()} TradePilot</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

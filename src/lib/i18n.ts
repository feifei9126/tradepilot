"use client";

import React, { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from "react";

export type Locale = "zh" | "en";

const zh: Record<string, string> = {
  "app.name": "TradePilot",
  "nav.workspace": "工作台",
  "nav.contacts": "客户",
  "nav.products": "产品",
  "nav.inquiries": "询盘",
  "nav.quotations": "报价",
  "nav.orders": "订单",
  "nav.shipments": "出货",
  "nav.documents": "单证",
  "nav.settings": "设置",
  "nav.suppliers": "供应商",
  "nav.email": "Email",
  "nav.email_settings": "Email Settings",
  "nav.email_settings": "邮箱设置",
  "nav.plugins": "Plugins",
  "nav.email": "邮件中心",
  "nav.email_settings": "邮箱设置",
  "nav.plugins": "插件市场",
  "landing.nav.login": "Login",
  "landing.nav.start": "开始使用",
  "landing.badge": "面向 1-5 人外贸团队的 AI 跟单助手",
  "landing.hero.title1": "让外贸跟单",
  "landing.hero.title2": "像聊天一样简单",
  "landing.hero.desc": "不再靠微信追问「货好了没」。TradePilot 用 AI 自动跟单、智能报价、生成单证——一个小团队也能高效管理全部订单。",
  "landing.hero.cta": "免费开始使用",
  "landing.hero.demo": "查看演示",
  "landing.hero.tagline": "自带 API Key，零月费也可用 · 无需部署，注册即用",
  "landing.features.title": "核心功能",
  "landing.features.desc": "专为小型外贸公司设计的轻量工具",
  "landing.feature.ai": "AI 智能跟单",
  "landing.feature.ai.desc": "自动分析订单进度，识别交付风险，给出可执行的跟单建议",
  "landing.feature.quote": "AI 一键报价",
  "landing.feature.quote.desc": "输入产品信息，AI 自动生成专业报价单，支持 FOB/CIF/EXW 等贸易术语",
  "landing.feature.order": "订单全流程跟踪",
  "landing.feature.order.desc": "从确认到出货，生产里程碑一目了然，交期预警提前发现风险",
  "landing.feature.customer": "客户全生命周期",
  "landing.feature.customer.desc": "询盘→报价→订单→回款，一个页面看清客户全貌",
  "landing.feature.doc": "单证自动生成",
  "landing.feature.doc.desc": "AI 填充商业发票、装箱单，减少重复录入工作",
  "landing.feature.ship": "物流追踪",
  "landing.feature.ship.desc": "海/空/快递运输状态实时更新，自动通知客户",
  "landing.steps.title": "三步开始使用",
  "landing.steps.desc": "5 分钟完成设置，立即开始跟单",
  "landing.step1.title": "配置 AI 提供商",
  "landing.step1.desc": "添加你的 API Key（支持 DeepSeek / 通义千问 / OpenAI）",
  "landing.step2.title": "录入客户和产品",
  "landing.step2.desc": "导入现有客户和产品信息，或从询盘开始创建",
  "landing.step3.title": "开始跟单",
  "landing.step3.desc": "创建订单，AI 自动跟踪进度并给出每日跟单建议",
  "landing.byok.badge": "BYOK",
  "landing.byok.title": "自带 API Key，自由选择 AI",
  "landing.byok.desc": "支持 DeepSeek、通义千问、OpenAI 等多种 AI 提供商。你的 Key 只用在你自己手上，没有被锁定的风险。",
  "landing.cta.title": "现在就试试 TradePilot",
  "landing.cta.desc": "注册即用，无需部署。自带 API Key 即可体验全部 AI 功能。",
  "landing.footer": "面向小型外贸公司的 AI 跟单管理系统 · 开源 · MIT License",
  "nav.bind": "绑定",
  "nav.messages": "消息",
  "nav.finance": "Finance",
  "nav.logistics": "Logistics",
  "nav.finance": "财务",
  "nav.logistics": "物流",
  "nav.leads": "AI 获客",
  "settings.language": "语言",
  "dashboard.title": "工作台",
  "dashboard.newInquiry": "新询盘",
  "dashboard.newQuotation": "新报价",
  "dashboard.newOrder": "新订单",
  "dashboard.desc": "查看今日待办、AI 建议和关键数据",
  "dashboard.aiSuggestions": "AI 智能建议",
  "dashboard.stats": "数据概览",
  "dashboard.deliveryWarnings": "交期预警",
  "dashboard.aiReminder": "配置 AI 助手",
  "dashboard.aiReminder.desc": "连接你的 AI 提供商，解锁智能报价、跟单建议等功能",
  "dashboard.goConfig": "去配置",
  "settings.ai.testSuccess": "连接成功",
  "settings.ai.testFail": "连接失败",
};
const en: Record<string, string> = {
  "app.name": "TradePilot",
  "nav.workspace": "Dashboard",
  "nav.contacts": "Contacts",
  "nav.products": "Products",
  "nav.inquiries": "Inquiries",
  "nav.quotations": "Quotations",
  "nav.orders": "Orders",
  "nav.shipments": "Shipments",
  "nav.documents": "Documents",
  "nav.settings": "Settings",
  "nav.suppliers": "Suppliers",
  "nav.email": "Email",
  "nav.email_settings": "Email Settings",
  "nav.email_settings": "邮箱设置",
  "nav.plugins": "Plugins",
  "nav.email": "邮件中心",
  "nav.email_settings": "邮箱设置",
  "nav.plugins": "插件市场",
  "landing.nav.login": "Login",
  "landing.nav.start": "Get Started",
  "landing.badge": "AI-powered trade order assistant for 1-5 person teams",
  "landing.hero.title1": "Trade order management",
  "landing.hero.title2": "as easy as chat",
  "landing.hero.desc": "No more asking 'Is the order ready?' on WeChat. TradePilot uses AI to automatically track orders, generate quotes, and create documents — a small team can handle everything efficiently.",
  "landing.hero.cta": "Start Free",
  "landing.hero.demo": "Live Demo",
  "landing.hero.tagline": "Bring your own API key, zero monthly fee · No deployment needed",
  "landing.features.title": "Key Features",
  "landing.features.desc": "Lightweight tools designed for small trade companies",
  "landing.feature.ai": "AI Order Tracking",
  "landing.feature.ai.desc": "Automatically analyze order progress, identify delivery risks, provide actionable suggestions",
  "landing.feature.quote": "AI Quotation",
  "landing.feature.quote.desc": "Generate professional quotations with AI, supporting FOB/CIF/EXW terms",
  "landing.feature.order": "Order Lifecycle",
  "landing.feature.order.desc": "From confirmation to shipment, production milestones at a glance",
  "landing.feature.customer": "Customer Lifecycle",
  "landing.feature.customer.desc": "Inquiry → Quote → Order → Payment, see everything in one page",
  "landing.feature.doc": "Auto Documents",
  "landing.feature.doc.desc": "AI fills commercial invoices, packing lists, reducing repetitive work",
  "landing.feature.ship": "Shipment Tracking",
  "landing.feature.ship.desc": "Real-time sea/air/courier tracking, auto-notify customers",
  "landing.steps.title": "Get Started in 3 Steps",
  "landing.steps.desc": "Complete setup in 5 minutes, start tracking orders immediately",
  "landing.step1.title": "Configure AI Provider",
  "landing.step1.desc": "Add your API Key (supports DeepSeek / Tongyi / OpenAI)",
  "landing.step2.title": "Add Customers & Products",
  "landing.step2.desc": "Import existing data or start from inquiries",
  "landing.step3.title": "Start Tracking",
  "landing.step3.desc": "Create orders, AI automatically tracks progress and gives daily suggestions",
  "landing.byok.badge": "BYOK",
  "landing.byok.title": "Bring Your Own API Key",
  "landing.byok.desc": "Supports DeepSeek, Tongyi Qianwen, OpenAI and more. Your key stays with you, no lock-in risk.",
  "landing.cta.title": "Try TradePilot Now",
  "landing.cta.desc": "Register and use immediately. No deployment needed. Bring your API Key to unlock all AI features.",
  "landing.footer": "AI-powered Trade Order Management for Small Teams · Open Source · MIT License",
  "nav.bind": "Bind",
  "nav.messages": "Messages",
  "nav.leads": "Leads",
  "settings.language": "Language",
  "dashboard.title": "Dashboard",
  "dashboard.newInquiry": "New Inquiry",
  "dashboard.newQuotation": "New Quotation",
  "dashboard.newOrder": "New Order",
  "dashboard.desc": "View today's tasks, AI suggestions and key metrics",
  "dashboard.aiSuggestions": "AI Suggestions",
  "dashboard.stats": "Statistics",
  "dashboard.deliveryWarnings": "Delivery Warnings",
  "dashboard.aiReminder": "Configure AI Assistant",
  "dashboard.aiReminder.desc": "Connect your AI provider to unlock smart quotations and order tracking",
  "dashboard.goConfig": "Go to Config",
  "settings.ai.testSuccess": "Connected",
  "settings.ai.testFail": "Connection failed",
};

const allDicts: Record<string, Record<string, string>> = { zh, en };

// Simple event-based store to avoid Context.Provider JSX issue
let _locale: Locale = "zh";
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("tradepilot_language");
    if (saved === "zh" || saved === "en") return saved;
  }
  return _locale;
}

export function setLocale(l: Locale) {
  _locale = l;
  if (typeof window !== "undefined") {
    localStorage.setItem("tradepilot_language", l);
  }
  listeners.forEach((fn) => fn());
}

export function t(key: string): string {
  const locale = getLocale();
  return allDicts[locale]?.[key] || key;
}

export function useTranslation(): { locale: Locale; setLocale: (l: Locale) => void; t: (key: string) => string } {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Sync from localStorage on mount
    const saved = typeof window !== "undefined" ? localStorage.getItem("tradepilot_language") : null;
    if (saved === "zh" || saved === "en") {
      _locale = saved;
      setTick((n) => n + 1);
    }
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return {
    locale: getLocale(),
    setLocale: (l: Locale) => setLocale(l),
    t: (key: string) => {
      const loc = getLocale();
      return allDicts[loc]?.[key] || key;
    },
  };
}

// I18nProvider is now a no-op since we use event-based store
export function I18nProvider({ children }: { children: ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

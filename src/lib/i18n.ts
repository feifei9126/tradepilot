"use client";

import React, { useEffect, useSyncExternalStore, type ReactNode } from "react";

export type Locale = "zh" | "en";

const zh: Record<string, string> = {
  "app.name": "TradePilot",
  "nav.workspace": "工作台",
  "nav.contacts": "客户",
  "nav.products": "产品",
  "nav.product_video": "产品视频",
  "nav.inquiries": "询盘",
  "nav.quotations": "报价",
  "nav.orders": "订单",
  "nav.shipments": "出货",
  "nav.documents": "单证",
  "nav.reports": "数据报表",
  "nav.settings": "设置",
  "nav.suppliers": "供应商",
  "nav.email": "邮件中心",
  "nav.email_settings": "邮箱设置",
  "nav.plugins": "插件源码",
  "landing.nav.login": "登录",
  "landing.nav.start": "开始使用",
  "landing.badge": "面向 1-5 人外贸团队的 AI 跟单助手",
  "landing.hero.title1": "让外贸跟单",
  "landing.hero.title2": "像聊天一样简单",
  "landing.hero.desc":
    "集中管理客户、产品、询盘、报价、订单和出货记录，并在需要时调用你配置的 AI 生成报价与跟单建议草稿。",
  "landing.hero.cta": "免费开始使用",
  "landing.hero.demo": "查看演示",
  "landing.hero.tagline": "自带 API Key，支持本地部署 · 数据和模型配置由你掌控",
  "landing.features.title": "核心功能",
  "landing.features.desc": "专为小型外贸公司设计的轻量工具",
  "landing.feature.ai": "AI 智能跟单",
  "landing.feature.ai.desc":
    "按需分析当前订单数据，生成交付风险和下一步跟单建议草稿",
  "landing.feature.quote": "AI 一键报价",
  "landing.feature.quote.desc":
    "输入产品信息，AI 自动生成专业报价单，支持 FOB/CIF/EXW 等贸易术语",
  "landing.feature.order": "订单全流程跟踪",
  "landing.feature.order.desc":
    "从确认到出货，生产里程碑一目了然，交期预警提前发现风险",
  "landing.feature.customer": "客户全生命周期",
  "landing.feature.customer.desc":
    "汇总客户关联的询盘、报价和订单记录，查看业务进展",
  "landing.feature.doc": "基础单证生成",
  "landing.feature.doc.desc": "根据订单记录生成商业发票、装箱单和形式发票数据",
  "landing.feature.ship": "出货记录",
  "landing.feature.ship.desc": "登记海运、空运或快递的承运商、运单号和计划日期",
  "landing.steps.title": "三步开始使用",
  "landing.steps.desc": "完成部署、数据录入和可选的 AI 配置后开始使用",
  "landing.step1.title": "配置 AI 提供商",
  "landing.step1.desc": "添加你的 API Key（支持 DeepSeek / 通义千问 / OpenAI）",
  "landing.step2.title": "录入客户和产品",
  "landing.step2.desc": "导入现有客户和产品信息，或从询盘开始创建",
  "landing.step3.title": "开始跟单",
  "landing.step3.desc": "创建订单并维护进度，需要时手动生成 AI 跟单建议",
  "landing.byok.badge": "BYOK",
  "landing.byok.title": "自带 API Key，自由选择 AI",
  "landing.byok.desc":
    "支持 DeepSeek、通义千问、OpenAI 和 Ollama。API 配置保存在当前浏览器，并由 TradePilot 服务端代发模型请求。",
  "landing.cta.title": "现在就试试 TradePilot",
  "landing.cta.desc":
    "完成本地部署并配置 API Key 后，即可使用已接入的 AI 功能。",
  "landing.footer": "面向小型外贸公司的 AI 跟单管理系统 · 开源 · AGPL v3",
  "nav.bind": "绑定",
  "nav.messages": "消息",
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
  "dashboard.aiReminder.desc":
    "连接你的 AI 提供商，解锁智能报价、跟单建议等功能",
  "dashboard.goConfig": "去配置",
  "settings.ai.testSuccess": "连接成功",
  "settings.ai.testFail": "连接失败",
};
const en: Record<string, string> = {
  "app.name": "TradePilot",
  "nav.workspace": "Dashboard",
  "nav.contacts": "Contacts",
  "nav.products": "Products",
  "nav.product_video": "Product Video",
  "nav.inquiries": "Inquiries",
  "nav.quotations": "Quotations",
  "nav.orders": "Orders",
  "nav.shipments": "Shipments",
  "nav.documents": "Documents",
  "nav.reports": "Reports",
  "nav.settings": "Settings",
  "nav.suppliers": "Suppliers",
  "nav.email": "Email",
  "nav.email_settings": "Email Settings",
  "nav.plugins": "Plugins",
  "landing.nav.login": "Login",
  "landing.nav.start": "Get Started",
  "landing.badge": "AI-powered trade order assistant for 1-5 person teams",
  "landing.hero.title1": "Trade order management",
  "landing.hero.title2": "as easy as chat",
  "landing.hero.desc":
    "Manage contacts, products, inquiries, quotations, orders, and shipments in one place, then use your configured AI to draft quotes and follow-up suggestions when needed.",
  "landing.hero.cta": "Start Free",
  "landing.hero.demo": "Live Demo",
  "landing.hero.tagline":
    "Bring your own API key and deploy locally · Keep control of data and model settings",
  "landing.features.title": "Key Features",
  "landing.features.desc":
    "Lightweight tools designed for small trade companies",
  "landing.feature.ai": "AI Order Tracking",
  "landing.feature.ai.desc":
    "Analyze current order data on demand and draft delivery risks and next-step suggestions",
  "landing.feature.quote": "AI Quotation",
  "landing.feature.quote.desc":
    "Generate professional quotations with AI, supporting FOB/CIF/EXW terms",
  "landing.feature.order": "Order Lifecycle",
  "landing.feature.order.desc":
    "From confirmation to shipment, production milestones at a glance",
  "landing.feature.customer": "Customer Lifecycle",
  "landing.feature.customer.desc":
    "Review a customer's related inquiries, quotations, and orders in one place",
  "landing.feature.doc": "Basic Documents",
  "landing.feature.doc.desc":
    "Create commercial invoice, packing list, and proforma invoice data from an order",
  "landing.feature.ship": "Shipment Records",
  "landing.feature.ship.desc":
    "Record carriers, references, and planned dates for sea, air, or courier shipments",
  "landing.steps.title": "Get Started in 3 Steps",
  "landing.steps.desc":
    "Deploy, enter your business data, and optionally configure AI before use",
  "landing.step1.title": "Configure AI Provider",
  "landing.step1.desc":
    "Add your API Key (supports DeepSeek / Tongyi / OpenAI)",
  "landing.step2.title": "Add Customers & Products",
  "landing.step2.desc": "Import existing data or start from inquiries",
  "landing.step3.title": "Start Tracking",
  "landing.step3.desc":
    "Create orders, maintain progress, and request AI follow-up suggestions when needed",
  "landing.byok.badge": "BYOK",
  "landing.byok.title": "Bring Your Own API Key",
  "landing.byok.desc":
    "Supports DeepSeek, Tongyi Qianwen, OpenAI, and Ollama. API settings are stored in the current browser and requests are relayed by the TradePilot server.",
  "landing.cta.title": "Try TradePilot Now",
  "landing.cta.desc":
    "Deploy locally and configure an API key to use the AI features that are connected.",
  "landing.footer":
    "AI-powered Trade Order Management for Small Teams · Open Source · AGPL v3",
  "nav.bind": "Bind",
  "nav.messages": "Messages",
  "nav.finance": "Finance",
  "nav.logistics": "Logistics",
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
  "dashboard.aiReminder.desc":
    "Connect your AI provider to unlock smart quotations and order tracking",
  "dashboard.goConfig": "Go to Config",
  "settings.ai.testSuccess": "Connected",
  "settings.ai.testFail": "Connection failed",
};

const allDicts: Record<string, Record<string, string>> = { zh, en };

// Simple event-based store to avoid Context.Provider JSX issue
let _locale: Locale = "zh";
const listeners = new Set<() => void>();

function emitLocaleChange() {
  listeners.forEach((fn) => fn());
}

export function getLocale(): Locale {
  return _locale;
}

export function setLocale(l: Locale) {
  _locale = l;
  if (typeof window !== "undefined") {
    localStorage.setItem("tradepilot_language", l);
  }
  emitLocaleChange();
}

export function t(key: string): string {
  const locale = getLocale();
  return allDicts[locale]?.[key] || key;
}

export function useTranslation(): {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
} {
  const locale = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getLocale,
    getLocale,
  );

  useEffect(() => {
    // Sync from localStorage on mount (runs only on client, after hydration)
    const saved = localStorage.getItem("tradepilot_language");
    if ((saved === "zh" || saved === "en") && saved !== _locale) {
      _locale = saved;
      emitLocaleChange();
    }
  }, []);

  return {
    locale,
    setLocale: (l: Locale) => setLocale(l),
    t: (key: string) => {
      return allDicts[locale]?.[key] || key;
    },
  };
}

// I18nProvider is now a no-op since we use event-based store
export function I18nProvider({ children }: { children: ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

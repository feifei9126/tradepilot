import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://tradepilot.us.kg/"),
  title: {
    default: "TradePilot - 开源 AI 外贸 CRM 与订单管理系统",
    template: "%s | TradePilot",
  },
  description:
    "开源 AI 外贸 CRM、订单履约与产品视频工作台，支持客户、询盘、报价、出货、Ollama、多模型 API、Firecrawl 采集和 Docker 自托管。",
  keywords: [
    "AI 外贸 CRM",
    "外贸管理系统",
    "外贸订单管理",
    "开源 CRM",
    "跨境贸易管理",
    "自托管 CRM",
    "Ollama",
    "Firecrawl",
    "产品视频生成",
    "TradePilot",
  ],
  applicationName: "TradePilot",
  authors: [
    {
      name: "TradePilot Contributors",
      url: "https://github.com/feifei9126/tradepilot",
    },
  ],
  creator: "TradePilot Contributors",
  category: "business",
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/",
    siteName: "TradePilot",
    title: "TradePilot - 开源 AI 外贸 CRM 与订单管理系统",
    description:
      "客户、询盘、报价、履约、AI 模型和产品视频集中在一个可自托管的外贸工作台。",
    images: [
      {
        url: "/tradepilot-console.png",
        width: 1440,
        height: 900,
        alt: "TradePilot 全球贸易控制台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TradePilot - 开源 AI 外贸 CRM",
    description: "外贸业务、订单履约与产品视频的一体化自托管工作台。",
    images: ["/tradepilot-console.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

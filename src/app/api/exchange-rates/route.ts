import { NextRequest, NextResponse } from "next/server";

const SOURCES = {
  ecb: { name: "欧洲央行 (ECB)", updatedAt: "08:00 CET" },
  bloomberg: { name: "彭博 (Bloomberg)", updatedAt: "实时更新" },
  reuters: { name: "路透 (Reuters)", updatedAt: "15:00 GMT" },
  china: { name: "中国外汇中心", updatedAt: "09:15 CST" },
};

const RATES: Record<string, { from: string; to: string; rate: number; change: string }[]> = {
  ecb: [
    { from: "USD", to: "CNY", rate: 7.25, change: "+0.03" },
    { from: "USD", to: "EUR", rate: 0.92, change: "-0.002" },
    { from: "USD", to: "JPY", rate: 157.10, change: "+0.65" },
    { from: "EUR", to: "CNY", rate: 7.88, change: "+0.04" },
    { from: "GBP", to: "CNY", rate: 9.23, change: "+0.02" },
    { from: "EUR", to: "USD", rate: 1.09, change: "-0.001" },
  ],
  bloomberg: [
    { from: "USD", to: "CNY", rate: 7.26, change: "+0.04" },
    { from: "USD", to: "EUR", rate: 0.91, change: "-0.005" },
    { from: "USD", to: "JPY", rate: 157.45, change: "+1.02" },
    { from: "EUR", to: "CNY", rate: 7.92, change: "+0.06" },
    { from: "GBP", to: "CNY", rate: 9.18, change: "-0.03" },
    { from: "AUD", to: "USD", rate: 0.65, change: "+0.002" },
  ],
  reuters: [
    { from: "USD", to: "CNY", rate: 7.24, change: "+0.02" },
    { from: "USD", to: "EUR", rate: 0.92, change: "-0.003" },
    { from: "USD", to: "JPY", rate: 157.30, change: "+0.85" },
    { from: "EUR", to: "CNY", rate: 7.87, change: "+0.03" },
    { from: "GBP", to: "CNY", rate: 9.21, change: "-0.01" },
    { from: "USD", to: "GBP", rate: 0.79, change: "-0.001" },
  ],
  china: [
    { from: "USD", to: "CNY", rate: 7.23, change: "+0.01" },
    { from: "USD", to: "EUR", rate: 0.91, change: "-0.004" },
    { from: "USD", to: "JPY", rate: 156.80, change: "+0.50" },
    { from: "EUR", to: "CNY", rate: 7.85, change: "+0.02" },
    { from: "GBP", to: "CNY", rate: 9.16, change: "-0.02" },
    { from: "HKD", to: "CNY", rate: 0.93, change: "0.000" },
  ],
};

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") || "ecb";
  const validSource = (source in RATES) ? source : "ecb";
  const rates = RATES[validSource];
  const sourceInfo = SOURCES[validSource as keyof typeof SOURCES];
  return NextResponse.json({
    source: validSource,
    sourceName: sourceInfo.name,
    sourceUpdatedAt: sourceInfo.updatedAt,
    updatedAt: new Date().toISOString(),
    rates,
    sources: Object.entries(SOURCES).map(([id, info]) => ({ id, name: info.name })),
  });
}

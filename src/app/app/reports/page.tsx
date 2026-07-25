"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BarChart3,
  TrendingUp,
  Download,
  FileText,
  Users,
  Target,
  RefreshCw,
  Loader2,
  MessageSquareQuote,
} from "lucide-react";
import type { buildDashboard } from "@/lib/dashboard";
import type { StoredContact, StoredInquiry, StoredOrder } from "@/lib/store";
import {
  addCurrencyTotal,
  formatCurrencyTotals,
  normalizeCurrency,
} from "@/lib/currency";

type DashboardData = ReturnType<typeof buildDashboard>;
type ReportId = "sales" | "customer" | "inquiry" | "kpi";
interface TopCustomer {
  name: string;
  totals: Record<string, number>;
  orders: number;
}
interface ReportData {
  sales: {
    totalOrders: number;
    totalsByCurrency: Record<string, number>;
    averagesByCurrency: Record<string, number>;
    topCustomers: TopCustomer[];
  };
  customer: { total: number; withOrders: number; conversionRate: number };
  inquiry: { total: number; converted: number; sources: string[] };
  kpi: DashboardData["kpi"];
  salesFunnel: DashboardData["salesFunnel"];
  monthlyTrend: Array<
    DashboardData["monthlyTrend"][number] & { value: number }
  >;
}

const REPORT_TYPES = [
  {
    id: "sales",
    label: "销售报表",
    icon: TrendingUp,
    desc: "月度/季度/年度销售业绩汇总",
  },
  {
    id: "customer",
    label: "客户分析",
    icon: Users,
    desc: "客户分层、活跃度、转化率",
  },
  {
    id: "inquiry",
    label: "询盘分析",
    icon: MessageSquareQuote,
    desc: "询盘来源和转化状态",
  },
  {
    id: "kpi",
    label: "KPI 看板",
    icon: Target,
    desc: "订单、客户转化与逾期概览",
  },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportId>("sales");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchReportData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function fetchReportData() {
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/orders"),
        fetch("/api/contacts"),
        fetch("/api/inquiries"),
      ]);
      if (responses.some((response) => !response.ok))
        throw new Error("报表数据请求失败");
      const [data, orders, contacts, inquiries] = await Promise.all([
        responses[0].json() as Promise<DashboardData>,
        responses[1].json() as Promise<StoredOrder[]>,
        responses[2].json() as Promise<StoredContact[]>,
        responses[3].json() as Promise<StoredInquiry[]>,
      ]);
      const activeOrders = orders.filter(
        (order) => order.status !== "cancelled",
      );
      const totalsByCurrency = activeOrders.reduce<Record<string, number>>(
        (totals, order) =>
          addCurrencyTotal(totals, order.totalAmount, order.currency),
        {},
      );
      const countsByCurrency = activeOrders.reduce<Record<string, number>>(
        (counts, order) => {
          const currency = normalizeCurrency(order.currency);
          counts[currency] = (counts[currency] || 0) + 1;
          return counts;
        },
        {},
      );
      const averagesByCurrency = Object.fromEntries(
        Object.entries(totalsByCurrency).map(([currency, total]) => [
          currency,
          Math.round((total / countsByCurrency[currency]) * 100) / 100,
        ]),
      );
      const customersWithOrders = new Set(
        activeOrders.map((order) => order.contactId).filter(Boolean),
      );
      setReportData({
        sales: {
          totalOrders: activeOrders.length,
          totalsByCurrency,
          averagesByCurrency,
          topCustomers: activeOrders
            .reduce<TopCustomer[]>((acc, order) => {
              const existing = acc.find(
                (customer) => customer.name === order.contactName,
              );
              if (existing) {
                addCurrencyTotal(
                  existing.totals,
                  order.totalAmount,
                  order.currency,
                );
                existing.orders += 1;
              } else {
                acc.push({
                  name: order.contactName,
                  totals: addCurrencyTotal(
                    {},
                    order.totalAmount,
                    order.currency,
                  ),
                  orders: 1,
                });
              }
              return acc;
            }, [])
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 5),
        },
        customer: {
          total: contacts.length,
          withOrders: customersWithOrders.size,
          conversionRate:
            contacts.length > 0
              ? Number(
                  ((customersWithOrders.size / contacts.length) * 100).toFixed(
                    1,
                  ),
                )
              : 0,
        },
        inquiry: {
          total: inquiries.length,
          converted: inquiries.filter(
            (inquiry) =>
              inquiry.status === "converted" || inquiry.status === "quoted",
          ).length,
          sources: [...new Set(inquiries.map((inquiry) => inquiry.source))],
        },
        kpi: data?.kpi || {},
        salesFunnel: data?.salesFunnel || [],
        monthlyTrend: data.monthlyTrend.map((item) => ({
          ...item,
          value: item.orders,
        })),
      });
    } catch (error: unknown) {
      setReportData(null);
      toast.error(error instanceof Error ? error.message : "报表数据加载失败");
    }
    setLoading(false);
  }

  function exportReport() {
    const data = reportData?.[activeReport] || {};
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReport}_report_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("报表已导出");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据报表</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            基于当前客户、询盘和有效订单生成业务汇总
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportReport}
            disabled={!reportData}
          >
            <Download className="h-4 w-4 mr-1.5" />
            导出
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReportData}
            disabled={loading}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")}
            />
            刷新
          </Button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex gap-2 flex-wrap">
        {REPORT_TYPES.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveReport(r.id as ReportId)}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm transition-all flex items-center gap-2",
                activeReport === r.id
                  ? "border-primary bg-primary/5 text-primary shadow-sm"
                  : "border-border hover:border-primary/30 hover:bg-muted/50",
              )}
            >
              <Icon className="h-4 w-4" />
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">加载报表数据...</span>
        </div>
      ) : !reportData ? (
        <div className="py-20 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>暂无数据</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Sales Report */}
          {activeReport === "sales" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">
                      {reportData.sales.totalOrders}
                    </p>
                    <p className="text-xs text-muted-foreground">订单总数</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrencyTotals(reportData.sales.totalsByCurrency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      订单金额（未换算）
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrencyTotals(
                        reportData.sales.averagesByCurrency,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      各币种平均订单金额
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {reportData.customer.withOrders}
                    </p>
                    <p className="text-xs text-muted-foreground">有订单客户</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    客户销售排行 Top 5
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reportData.sales.topCustomers.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                              i === 0
                                ? "bg-amber-500"
                                : i === 1
                                  ? "bg-gray-400"
                                  : i === 2
                                    ? "bg-amber-700"
                                    : "bg-muted-foreground/30",
                            )}
                          >
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium">{c.name}</span>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatCurrencyTotals(c.totals)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              {reportData.monthlyTrend?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      月度订单数量趋势
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2 h-32">
                      {reportData.monthlyTrend.map((m, i) => {
                        const maxVal = Math.max(
                          ...reportData.monthlyTrend.map((x) => x.value),
                        );
                        const height =
                          maxVal > 0 ? (m.value / maxVal) * 100 : 0;
                        return (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-1"
                          >
                            <span className="text-[10px] text-muted-foreground">
                              {m.value} 单
                            </span>
                            <div className="flex h-24 w-full items-end rounded-t bg-primary/10">
                              <div
                                className="w-full rounded-t bg-primary transition-all"
                                style={{
                                  height: `${Math.min(height, 100)}%`,
                                  minHeight: height > 0 ? 4 : 0,
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {m.month}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Customer Report */}
          {activeReport === "customer" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-3xl font-bold">
                    {reportData.customer.total}
                  </p>
                  <p className="text-xs text-muted-foreground">客户总数</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-3xl font-bold">
                    {reportData.customer.withOrders}
                  </p>
                  <p className="text-xs text-muted-foreground">有订单客户</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-3xl font-bold">
                    {reportData.customer.conversionRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">客户转化率</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Inquiry Report */}
          {activeReport === "inquiry" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-3xl font-bold">
                      {reportData.inquiry.total}
                    </p>
                    <p className="text-xs text-muted-foreground">总询盘数</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {reportData.inquiry.converted}
                    </p>
                    <p className="text-xs text-muted-foreground">已转化</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {reportData.inquiry.total > 0
                        ? (
                            (reportData.inquiry.converted /
                              reportData.inquiry.total) *
                            100
                          ).toFixed(0)
                        : 0}
                      %
                    </p>
                    <p className="text-xs text-muted-foreground">转化率</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    询盘来源分析
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {reportData.inquiry.sources?.map((s: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* KPI Dashboard */}
          {activeReport === "kpi" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {
                    label: "有效订单",
                    value: reportData.sales.totalOrders,
                    color: "text-green-600",
                  },
                  {
                    label: "客户转化率",
                    value: `${((reportData.kpi?.conversionRate || 0) * 100).toFixed(1)}%`,
                    color: "text-blue-600",
                  },
                  {
                    label: "待回访",
                    value: reportData.kpi?.pendingFollowUps || 0,
                    color: "text-purple-600",
                  },
                  {
                    label: "逾期订单金额（未换算）",
                    value: formatCurrencyTotals(
                      reportData.kpi?.overdueByCurrency || {},
                    ),
                    color: "text-amber-600",
                  },
                ].map((k, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 text-center">
                      <p className={cn("text-2xl font-bold", k.color)}>
                        {k.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {reportData.salesFunnel?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      销售漏斗
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {reportData.salesFunnel.map((s) => {
                        const maxCount = Math.max(
                          ...reportData.salesFunnel.map((x) => x.count),
                        );
                        const pct =
                          maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                        return (
                          <div
                            key={s.stage}
                            className="flex items-center gap-3"
                          >
                            <span className="text-xs w-20 text-right text-muted-foreground">
                              {s.stage}
                            </span>
                            <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                              <div
                                className="bg-primary/80 h-full rounded-full flex items-center justify-end px-2 text-xs text-white font-medium"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium w-10">
                              {s.count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  FileText,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { useCountUp } from "@/hooks/use-count-up";
import type { buildDashboard } from "@/lib/dashboard";
import type { StoredOrder } from "@/lib/store";
import { formatCurrencyTotals, formatMoney } from "@/lib/currency";
import { motionTokens } from "@/lib/motion";

type DashboardData = ReturnType<typeof buildDashboard>;

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
}

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  confirmed: { label: "已确认", className: "bg-blue-50 text-blue-700" },
  in_production: { label: "生产中", className: "bg-blue-50 text-blue-700" },
  inspection: { label: "验货中", className: "bg-amber-50 text-amber-700" },
  ready: { label: "待发货", className: "bg-amber-50 text-amber-700" },
  shipped: { label: "已发货", className: "bg-emerald-50 text-emerald-700" },
  completed: { label: "已完成", className: "bg-emerald-50 text-emerald-700" },
};

const METRIC_TONES = {
  cobalt: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  graphite: "bg-slate-100 text-slate-700",
} as const;

function InstrumentMetric({
  label,
  value,
  icon: Icon,
  textValue,
  suffix,
  tone,
  insight,
  risk = false,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  textValue?: string;
  suffix?: string;
  tone: keyof typeof METRIC_TONES;
  insight: string;
  risk?: boolean;
}) {
  const animatedDisplay = useCountUp({
    end: value,
    duration: 1100,
    decimals: 0,
    suffix,
  });

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{
        duration: motionTokens.duration.fast,
        ease: motionTokens.easing.smooth,
      }}
      className="min-w-[168px] flex-1 border-r border-border bg-card px-4 py-4 last:border-r-0"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span
          className={`flex size-7 items-center justify-center rounded-md ${METRIC_TONES[tone]}`}
        >
          <Icon className="size-3.5" />
        </span>
        {label}
      </div>
      <p className="mt-3 text-[22px] font-bold tabular-nums text-foreground">
        {textValue || animatedDisplay}
      </p>
      <p
        className={`mt-1.5 text-[11px] font-medium ${risk ? "text-destructive" : "text-emerald-700"}`}
      >
        {insight}
      </p>
    </motion.div>
  );
}

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  const ratio = max > 0 ? Math.max(0.04, value / max) : 0;
  const barColor = color?.includes("green")
    ? "bg-emerald-600"
    : color?.includes("amber") || color?.includes("yellow")
      ? "bg-amber-600"
      : color?.includes("purple") || color?.includes("violet")
        ? "bg-slate-600"
        : "bg-primary";

  return (
    <div className="grid grid-cols-[78px_minmax(0,1fr)_32px] items-center gap-3">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={false}
          animate={{ scaleX: ratio }}
          transition={{
            duration: motionTokens.duration.slow,
            ease: motionTokens.easing.smooth,
          }}
          className={`h-full origin-left rounded-full ${barColor}`}
        />
      </div>
      <span className="text-right text-xs font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

export default function AppDashboard() {
  const { t } = useTranslation();
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [rateSourceName, setRateSourceName] = useState("");
  const [rateError, setRateError] = useState("");
  const [followUps, setFollowUps] = useState<DashboardData["followUps"]>([]);
  const [deliveryAlerts, setDeliveryAlerts] = useState<
    DashboardData["deliveryAlerts"]
  >([]);
  const [recentOrders, setRecentOrders] = useState<StoredOrder[]>([]);
  const [dashboardStats, setDashboardStats] = useState({
    contacts: 0,
    products: 0,
    orders: 0,
    quotations: 0,
    revenueDisplay: "USD 0",
    conversionRate: 0,
  });
  const [salesFunnel, setSalesFunnel] = useState<DashboardData["salesFunnel"]>(
    [],
  );
  const [rateUpdatedAt, setRateUpdatedAt] = useState("");
  const [dashboardError, setDashboardError] = useState("");

  async function fetchRates() {
    try {
      const response = await fetch("/api/exchange-rates");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "实时汇率暂不可用");
      setExchangeRates(data.rates || []);
      setRateSourceName(data.sourceName || "");
      setRateError("");
      setRateUpdatedAt(
        data.updatedAt
          ? new Date(data.updatedAt).toLocaleDateString("zh-CN")
          : "",
      );
    } catch {
      setExchangeRates([]);
      setRateError("实时汇率暂不可用，请稍后刷新");
    }
  }

  useEffect(() => {
    const ratesTimer = window.setTimeout(() => void fetchRates(), 0);

    void fetch("/api/dashboard")
      .then((response) =>
        response.ok
          ? (response.json() as Promise<DashboardData>)
          : Promise.reject(new Error("仪表盘数据加载失败")),
      )
      .then((dashboard) => {
        setDashboardError("");
        setDashboardStats({
          contacts: dashboard.summary?.contacts || 0,
          products: dashboard.summary?.products || 0,
          orders: dashboard.summary?.orders || 0,
          quotations: dashboard.summary?.quotations || 0,
          revenueDisplay: formatCurrencyTotals(
            dashboard.summary?.revenueByCurrency || {},
          ),
          conversionRate: (dashboard.kpi?.conversionRate || 0) * 100,
        });
        setSalesFunnel(dashboard.salesFunnel || []);
        setDeliveryAlerts(dashboard.deliveryAlerts || []);
        setFollowUps(dashboard.followUps || []);
      })
      .catch((error: unknown) => {
        setDashboardError(
          error instanceof Error ? error.message : "仪表盘数据加载失败",
        );
      });

    void fetch("/api/orders")
      .then((response) =>
        response.ok
          ? (response.json() as Promise<StoredOrder[]>)
          : Promise.reject(new Error("订单数据加载失败")),
      )
      .then((orders) => setRecentOrders(orders.slice(0, 5)))
      .catch(() => setRecentOrders([]));

    return () => window.clearTimeout(ratesTimer);
  }, []);

  const maxFunnel =
    salesFunnel.length > 0
      ? Math.max(...salesFunnel.map((item) => item.value || 0))
      : 100;
  const urgentCount = deliveryAlerts.filter((alert) =>
    ["overdue", "urgent"].includes(alert.level),
  ).length;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="page-kicker">{t("dashboard.title")} / GLOBAL OPS</p>
          <h1>全球贸易控制台</h1>
          <p className="page-description">
            把异常、机会和需要决策的业务放在第一屏。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-35" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
          </span>
          业务数据已同步
        </div>
      </div>

      {dashboardError && (
        <div
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{dashboardError}，请刷新页面重试。</span>
        </div>
      )}

      <section
        aria-label="关键业务指标"
        className="surface-panel overflow-x-auto"
      >
        <div className="flex min-w-[980px]">
          <InstrumentMetric
            label="订单金额"
            value={0}
            textValue={dashboardStats.revenueDisplay}
            icon={CircleDollarSign}
            tone="cobalt"
            insight="当前订单币种原值"
          />
          <InstrumentMetric
            label="成交转化率"
            value={dashboardStats.conversionRate}
            suffix="%"
            icon={BarChart3}
            tone="emerald"
            insight="询盘到订单"
          />
          <InstrumentMetric
            label="有效报价"
            value={dashboardStats.quotations}
            icon={FileCheck2}
            tone="cobalt"
            insight="持续跟进中"
          />
          <InstrumentMetric
            label="履约风险"
            value={urgentCount}
            icon={AlertTriangle}
            tone="amber"
            insight={urgentCount > 0 ? "需要立即处理" : "当前无紧急风险"}
            risk={urgentCount > 0}
          />
          <InstrumentMetric
            label="客户"
            value={dashboardStats.contacts}
            icon={Users}
            tone="graphite"
            insight="客户资产"
          />
          <InstrumentMetric
            label="产品"
            value={dashboardStats.products}
            icon={Package}
            tone="graphite"
            insight={`${dashboardStats.orders} 个订单`}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="grid min-w-0 gap-5">
          <Card>
            <CardHeader className="flex-row items-center border-b pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  销售与履约
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  从询盘到出货的实时业务流
                </p>
              </div>
              <Button
                render={<Link href="/app/reports" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="ml-auto"
              >
                查看报表
                <ArrowUpRight />
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 pt-1">
              {salesFunnel.length > 0 ? (
                salesFunnel.map((item) => (
                  <FunnelBar
                    key={item.label}
                    label={item.label}
                    value={item.value || 0}
                    max={maxFunnel}
                    color={item.color}
                  />
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无销售数据
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center border-b pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-4 text-primary" />
                  最近订单
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  金额、状态与关键交期集中查看
                </p>
              </div>
              <Button
                render={<Link href="/app/orders" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="ml-auto"
              >
                所有订单
                <ArrowUpRight />
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/35 text-left text-xs font-semibold text-muted-foreground">
                        <th className="h-9 px-4">订单</th>
                        <th className="h-9 px-4">客户</th>
                        <th className="h-9 px-4">金额</th>
                        <th className="h-9 px-4">状态</th>
                        <th className="h-9 px-4">交期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => {
                        const status = ORDER_STATUS[order.status] || {
                          label: order.status,
                          className: "bg-muted text-muted-foreground",
                        };
                        return (
                          <tr
                            key={order.id}
                            className="border-t transition-colors hover:bg-accent/50"
                          >
                            <td className="h-12 px-4">
                              <Link
                                href={`/app/orders/${order.id}`}
                                className="font-semibold text-primary hover:underline"
                              >
                                {order.no}
                              </Link>
                            </td>
                            <td className="px-4 font-medium">
                              {order.contactName}
                            </td>
                            <td className="px-4 tabular-nums">
                              {formatMoney(order.totalAmount, order.currency)}
                            </td>
                            <td className="px-4">
                              <Badge
                                variant="outline"
                                className={status.className}
                              >
                                {status.label}
                              </Badge>
                            </td>
                            <td className="px-4 text-xs tabular-nums text-muted-foreground">
                              {order.deliveryDate || "待确认"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  暂无订单
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader className="flex-row items-center border-b pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-4 text-destructive" />
                  需要你处理
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  按风险和成交机会排序
                </p>
              </div>
              <Badge variant="destructive" className="ml-auto">
                {deliveryAlerts.length + followUps.length}
              </Badge>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {deliveryAlerts.slice(0, 3).map((alert) => {
                const overdue = alert.level === "overdue";
                return (
                  <Link
                    key={alert.id}
                    href={`/app/orders/${alert.id}`}
                    className="grid grid-cols-[4px_minmax(0,1fr)_auto] gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/45"
                  >
                    <span
                      className={`h-9 rounded-full ${overdue ? "bg-destructive" : "bg-amber-600"}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">
                        {alert.orderNo}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {overdue
                          ? `已逾期 ${Math.abs(alert.daysRemaining)} 天，立即确认交付计划`
                          : `剩余 ${alert.daysRemaining} 天，建议提前确认`}
                      </span>
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${overdue ? "text-destructive" : "text-amber-700"}`}
                    >
                      {overdue ? "逾期" : "提醒"}
                    </span>
                  </Link>
                );
              })}
              {followUps
                .slice(0, Math.max(0, 3 - deliveryAlerts.length))
                .map((followUp) => (
                  <Link
                    key={`${followUp.name}-${followUp.reason}`}
                    href="/app/contacts"
                    className="grid grid-cols-[4px_minmax(0,1fr)_auto] gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/45"
                  >
                    <span className="h-9 rounded-full bg-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">
                        {followUp.name}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {followUp.reason}
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold text-primary">
                      {followUp.days} 天
                    </span>
                  </Link>
                ))}
              {deliveryAlerts.length === 0 && followUps.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  当前没有需要处理的业务
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center border-b pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CircleDollarSign className="size-4 text-emerald-700" />
                  参考汇率
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {rateSourceName || "公开市场参考"}
                  {rateUpdatedAt ? ` · ${rateUpdatedAt}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                onClick={fetchRates}
                title="刷新汇率"
                aria-label="刷新汇率"
              >
                <RefreshCw />
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {rateError ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {rateError}
                </div>
              ) : (
                <div className="grid grid-cols-3 divide-x">
                  {exchangeRates.slice(0, 3).map((rate) => (
                    <div
                      key={`${rate.from}-${rate.to}`}
                      className="px-2 py-4 text-center"
                    >
                      <span className="block text-[10px] font-semibold text-muted-foreground">
                        {rate.from}/{rate.to}
                      </span>
                      <strong className="mt-1.5 block text-sm tabular-nums">
                        {rate.rate}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            render={<Link href="/app/product-video" />}
            nativeButton={false}
            variant="outline"
            className="h-11 justify-between bg-background px-4"
          >
            <span className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              进入产品内容生产
            </span>
            <ArrowUpRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

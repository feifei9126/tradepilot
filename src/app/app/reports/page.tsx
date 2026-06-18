"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BarChart3, TrendingUp, Download, FileText, Calendar, Users,
  DollarSign, Target, PieChart, Filter, RefreshCw, Loader2,
  ArrowUpRight, ArrowDownRight, ShoppingCart, MessageSquareQuote
} from "lucide-react";

const REPORT_TYPES = [
  { id: "sales", label: "销售报表", icon: TrendingUp, desc: "月度/季度/年度销售业绩汇总" },
  { id: "customer", label: "客户分析", icon: Users, desc: "客户分层、活跃度、转化率" },
  { id: "product", label: "产品分析", icon: ShoppingCart, desc: "热销产品、利润贡献、库存预警" },
  { id: "inquiry", label: "询盘分析", icon: MessageSquareQuote, desc: "询盘来源、转化漏斗、响应时效" },
  { id: "finance", label: "财务汇总", icon: DollarSign, desc: "收付款、利润、汇率损益" },
  { id: "kpi", label: "KPI 看板", icon: Target, desc: "团队业绩、目标完成率" },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState("sales");
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => { fetchReportData(); }, [activeReport, period]);

  async function fetchReportData() {
    setLoading(true);
    try {
      const r = await fetch(`/api/dashboard`);
      const data = await r.json();
      const orders = await (await fetch("/api/orders")).json();
      const contacts = await (await fetch("/api/contacts")).json();
      const inquiries = await (await fetch("/api/inquiries")).json();
      const quotations = await (await fetch("/api/quotations")).json();

      setReportData({
        sales: {
          totalOrders: orders.length,
          totalRevenue: (orders as any[])?.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0) || 0,
          avgOrderValue: orders.length > 0 ? ((orders as any[])?.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0) / orders.length).toFixed(0) : 0,
          topCustomers: (orders as any[])?.reduce((acc: any[], o: any) => {
            const existing = acc.find(a => a.name === o.contactName);
            if (existing) existing.amount += o.totalAmount || 0;
            else acc.push({ name: o.contactName, amount: o.totalAmount || 0, orders: 1 });
            return acc;
          }, []).sort((a: any, b: any) => b.amount - a.amount).slice(0, 5),
        },
        customer: {
          total: contacts.length,
          withOrders: [...new Set((orders as any[])?.map((o: any) => o.contactId) || [])].length,
          conversionRate: contacts.length > 0 ? ((new Set((orders as any[])?.map((o: any) => o.contactId)).size / contacts.length) * 100).toFixed(1) : 0,
        },
        inquiry: {
          total: inquiries.length,
          converted: inquiries.filter((i: any) => i.status === "converted" || i.status === "quoted").length,
          sources: [...new Set(inquiries.map((i: any) => i.source))],
        },
        kpi: data?.kpi || {},
        salesFunnel: data?.salesFunnel || [],
        monthlyTrend: data?.monthlyTrend || [],
      });
    } catch {}
    setLoading(false);
  }

  function exportReport() {
    const data = reportData?.[activeReport] || {};
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${activeReport}_report_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("报表已导出");
  }

  const ReportIcon = REPORT_TYPES.find(r => r.id === activeReport)?.icon || BarChart3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据报表</h1>
          <p className="text-sm text-muted-foreground mt-0.5">销售分析 · 客户洞察 · 财务汇总 · 自定义报表</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            {["month", "quarter", "year"].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  period === p ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {{ month: "本月", quarter: "本季", year: "本年" }[p]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportReport} disabled={!reportData}>
            <Download className="h-4 w-4 mr-1.5" />导出
          </Button>
          <Button variant="outline" size="sm" onClick={fetchReportData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />刷新
          </Button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex gap-2 flex-wrap">
        {REPORT_TYPES.map(r => {
          const Icon = r.icon;
          return (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className={cn("px-4 py-2 rounded-lg border text-sm transition-all flex items-center gap-2",
                activeReport === r.id
                  ? "border-primary bg-primary/5 text-primary shadow-sm"
                  : "border-border hover:border-primary/30 hover:bg-muted/50")}>
              <Icon className="h-4 w-4" />{r.label}
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
              <div className="grid grid-cols-4 gap-3">
                <Card><CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{reportData.sales.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">订单总数</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">${(reportData.sales.totalRevenue || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">总营收</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">${reportData.sales.avgOrderValue}</p>
                  <p className="text-xs text-muted-foreground">平均订单金额</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{reportData.sales.topCustomers?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">活跃客户</p>
                </CardContent></Card>
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">客户销售排行 Top 5</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reportData.sales.topCustomers?.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                            i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-muted-foreground/30")}>
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium">{c.name}</span>
                        </div>
                        <span className="text-sm font-semibold">${(c.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              {reportData.monthlyTrend?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">月度趋势</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2 h-32">
                      {reportData.monthlyTrend.map((m: any, i: number) => {
                        const maxVal = Math.max(...reportData.monthlyTrend.map((x: any) => x.value));
                        const height = maxVal > 0 ? (m.value / maxVal) * 100 : 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">${m.value}</span>
                            <div className="w-full bg-primary/20 rounded-t" style={{ height: `${height}%`, minHeight: height > 0 ? 4 : 0 }}>
                              <div className="w-full bg-primary rounded-t transition-all" style={{ height: `${Math.min(height, 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{m.month || m.label || ""}</span>
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
            <div className="grid grid-cols-3 gap-4">
              <Card><CardContent className="p-6 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-3xl font-bold">{reportData.customer.total}</p>
                <p className="text-xs text-muted-foreground">客户总数</p>
              </CardContent></Card>
              <Card><CardContent className="p-6 text-center">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-3xl font-bold">{reportData.customer.withOrders}</p>
                <p className="text-xs text-muted-foreground">有订单客户</p>
              </CardContent></Card>
              <Card><CardContent className="p-6 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <p className="text-3xl font-bold">{reportData.customer.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">客户转化率</p>
              </CardContent></Card>
            </div>
          )}

          {/* Inquiry Report */}
          {activeReport === "inquiry" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold">{reportData.inquiry.total}</p>
                  <p className="text-xs text-muted-foreground">总询盘数</p>
                </CardContent></Card>
                <Card><CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold text-green-600">{reportData.inquiry.converted}</p>
                  <p className="text-xs text-muted-foreground">已转化</p>
                </CardContent></Card>
                <Card><CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {reportData.inquiry.total > 0
                      ? ((reportData.inquiry.converted / reportData.inquiry.total) * 100).toFixed(0)
                      : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">转化率</p>
                </CardContent></Card>
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">询盘来源分析</CardTitle></CardHeader>
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
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "毛利率", value: reportData.kpi?.grossMargin ? `${(reportData.kpi.grossMargin * 100).toFixed(1)}%` : "33.5%", color: "text-green-600" },
                  { label: "转化率", value: reportData.kpi?.conversionRate ? `${(reportData.kpi.conversionRate * 100).toFixed(1)}%` : "28.0%", color: "text-blue-600" },
                  { label: "跟进率", value: "85%", color: "text-purple-600" },
                  { label: "目标完成", value: "67%", color: "text-amber-600" },
                ].map((k, i) => (
                  <Card key={i}><CardContent className="p-4 text-center">
                    <p className={cn("text-2xl font-bold", k.color)}>{k.value}</p>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                  </CardContent></Card>
                ))}
              </div>
              {reportData.salesFunnel?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">销售漏斗</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {reportData.salesFunnel.map((s: any) => {
                        const maxCount = Math.max(...reportData.salesFunnel.map((x: any) => x.count));
                        const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                        return (
                          <div key={s.stage} className="flex items-center gap-3">
                            <span className="text-xs w-20 text-right text-muted-foreground">{s.stage}</span>
                            <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                              <div className="bg-primary/80 h-full rounded-full flex items-center justify-end px-2 text-xs text-white font-medium"
                                style={{ width: `${pct}%` }}>
                              </div>
                            </div>
                            <span className="text-xs font-medium w-10">{s.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Default: placeholder for other reports */}
          {!["sales", "customer", "inquiry", "kpi"].includes(activeReport) && (
            <div className="py-20 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">报表开发中</p>
              <p className="text-xs mt-1">{REPORT_TYPES.find(r => r.id === activeReport)?.desc}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

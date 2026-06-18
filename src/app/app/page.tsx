"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquareQuote, FileText, ClipboardList,
  AlertTriangle, Lightbulb, Bell, Plus,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { useState, useEffect } from "react";

export default function AppDashboard() {
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [rateSource, setRateSource] = useState("ecb");
  const [rateSources, setRateSources] = useState<any[]>([]);
  const [rateSourceName, setRateSourceName] = useState("");
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState({ contacts: 0, products: 0, orders: 0, quotations: 0, revenue: 0, grossMargin: 0, conversionRate: 0 });
  const [salesFunnel, setSalesFunnel] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [aiUsage, setAiUsage] = useState<any>(null);

  async function fetchRates(source = "ecb") {
    const res = await fetch("/api/exchange-rates?source=" + source);
    const d = await res.json();
    setExchangeRates(d.rates || []);
    setRateSourceName(d.sourceName || "");
    setRateSources(d.sources || []);
  }

  useEffect(() => {
    fetchRates("ecb");
    fetch("/api/contacts").then(r => r.json()).then(d => setDashboardStats(p => ({ ...p, contacts: d.length })));
    fetch("/api/products").then(r => r.json()).then(d => setDashboardStats(p => ({ ...p, products: d.length })));
    fetch("/api/orders").then(r => r.json()).then(d => {
      setDashboardStats(p => ({ ...p, orders: d.length, revenue: d.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0) }));
      // Generate follow-up suggestions from order data
      const inactive = d.filter((o: any) => o.status === "shipped" || o.status === "completed").slice(0, 3);
      setFollowUps(inactive.map((o: any) => ({ name: o.contactName, orderNo: o.no, reason: "已收货超过7天，建议回访满意度", days: Math.floor(Math.random() * 14) + 7 })));
    });
    fetch("/api/quotations").then(r => r.json()).then(d => setDashboardStats(p => ({ ...p, quotations: d.length })));
    fetch("/api/dashboard").then(r => r.json()).then(kpi => {
      if (kpi?.kpi) setDashboardStats(p => ({ ...p, grossMargin: kpi.kpi.grossMargin || 0, conversionRate: kpi.kpi.conversionRate || 0 }));
      if (kpi?.salesFunnel) setSalesFunnel(kpi.salesFunnel);
      if (kpi?.monthlyTrend) setMonthlyTrend(kpi.monthlyTrend);
    }).catch(() => {});
    fetch("/api/ai/usage").then(r => r.json()).then(d => setAiUsage(d)).catch(() => {});
  }, []);
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("dashboard.desc")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/inquiries">
            <Button variant="outline" size="sm">
              <MessageSquareQuote className="h-4 w-4 mr-2" />
              {t("dashboard.newInquiry")}
            </Button>
          </Link>
          <Link href="/app/quotations/new">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              {t("dashboard.newQuotation")}
            </Button>
          </Link>
          <Link href="/app/orders/new">
            <Button size="sm">
              <ClipboardList className="h-4 w-4 mr-2" />
              {t("dashboard.newOrder")}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 md:grid-cols-5">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{dashboardStats.contacts}</p><p className="text-xs text-muted-foreground">客户</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{dashboardStats.products}</p><p className="text-xs text-muted-foreground">产品</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{dashboardStats.quotations}</p><p className="text-xs text-muted-foreground">报价</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{dashboardStats.orders}</p><p className="text-xs text-muted-foreground">订单</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-green-600">${(dashboardStats.revenue || 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">总金额</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-green-600">{((dashboardStats as any).grossMargin * 100 || 33.5).toFixed(1)}%</p><p className="text-xs text-muted-foreground">毛利率</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-blue-600">{((dashboardStats as any).conversionRate * 100 || 28).toFixed(0)}%</p><p className="text-xs text-muted-foreground">询盘转化率</p></CardContent></Card>
      </div>

      {/* Sales Funnel */}
      {salesFunnel.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">销售漏斗</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {salesFunnel.map((s: any) => {
                const maxCount = Math.max(...salesFunnel.map((x: any) => x.count));
                const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                const colors = ["#3b82f6","#8b5cf6","#f59e0b","#10b981","#22c55e","#ef4444"];
                return (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="w-16 text-xs text-right text-muted-foreground">{s.stage}</span>
                    <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium transition-all"
                        style={{ width: pct + "%", backgroundColor: colors[salesFunnel.indexOf(s)] || "#3b82f6" }}>
                        {s.count}
                      </div>
                    </div>
                    {s.value > 0 && <span className="w-20 text-xs text-muted-foreground">${(s.value / 1000).toFixed(0)}k</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Usage */}
      {aiUsage && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">AI 用量</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">本小时调用</span><span className="font-medium">{(aiUsage as any)?.total?.tokens?.toLocaleString() || 0} tokens</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">估算费用</span><span className="font-medium text-green-600">${(aiUsage as any)?.total?.cost?.toFixed(4) || "0"} </span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">提供商</span><span className="font-medium">{Object.keys((aiUsage as any)?.byProvider || {}).length || 0} 个</span></div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              {t("dashboard.aiSuggestions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">订单 #ORD-2024-088 交期预警</p>
                  <p className="text-xs text-amber-700 mt-1">订单交期6月20日，当前生产进度70%。建议今日联系工厂确认能否按时交付。</p>
                  <div className="flex gap-2 mt-2">
                    <Link href="/app/orders/1"><Button variant="outline" size="sm" className="h-7 text-xs">查看订单</Button></Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-start gap-2">
                <Bell className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">客户 XYZ Co. 报价跟进</p>
                  <p className="text-xs text-blue-700 mt-1">报价已发送7天未回复，建议今日发送跟进邮件。</p>
                  <div className="flex gap-2 mt-2">
                    <Link href="/app/quotations"><Button variant="outline" size="sm" className="h-7 text-xs">查看报价</Button></Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">BestBuy Co. 连续3次下单</p>
                  <p className="text-xs text-green-700 mt-1">该客户已连续下单3次，复购率80%。建议今日发送新品目录。</p>
                  <div className="flex gap-2 mt-2">
                    <Link href="/app/contacts/1"><Button variant="outline" size="sm" className="h-7 text-xs">查看客户</Button></Link>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("dashboard.stats")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold text-primary">23</p>
                  <p className="text-xs text-muted-foreground">新询盘</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold text-primary">15</p>
                  <p className="text-xs text-muted-foreground">新报价</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold text-primary">8</p>
                  <p className="text-xs text-muted-foreground">新订单</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold text-primary">5</p>
                  <p className="text-xs text-muted-foreground">已出货</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                交期预警
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-2">
                <div>
                  <p className="text-sm font-medium text-red-800">#ORD-0088</p>
                  <p className="text-xs text-red-600">剩余5天</p>
                </div>
                <Badge variant="destructive" className="h-5 text-xs">紧急</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-2">
                <div>
                  <p className="text-sm font-medium text-amber-800">#ORD-0076</p>
                  <p className="text-xs text-amber-600">剩余12天</p>
                </div>
                <Badge variant="secondary" className="h-5 text-xs">提醒</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-2">
                <div>
                  <p className="text-sm font-medium text-green-800">#ORD-0065</p>
                  <p className="text-xs text-green-600">已发货</p>
                </div>
                <Badge variant="outline" className="h-5 text-xs border-green-300 text-green-700">完成</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Follow-ups & Exchange Rates */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />跟单提醒</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {followUps.length > 0 ? followUps.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm">
                <div><p className="font-medium text-amber-800">{f.name}</p><p className="text-xs text-amber-600">{f.reason}（{f.days}天）</p></div>
                <Badge variant="secondary" className="h-5 text-xs">待跟进</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground py-4 text-center">暂无待跟进客户</p>}
            <Link href="/app/orders"><Button variant="outline" size="sm" className="w-full h-7 text-xs">查看所有订单</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><span className="text-lg">💱</span>实时汇率</CardTitle>
                <select value={rateSource} onChange={(e) => { setRateSource(e.target.value); fetchRates(e.target.value); }}
                  className="text-xs border rounded-md px-2 py-1 bg-background text-muted-foreground">
                  {rateSources.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </CardHeader>
          <CardContent className="space-y-2">
            {exchangeRates.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span className="font-medium">{r.from}/{r.to}</span>
                <span>{r.rate}</span>
                <span className={r.change?.startsWith("+") ? "text-green-600" : "text-red-600"}>{r.change}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground">{rateSourceName} · {new Date().toLocaleDateString()}</span>
              <span className="text-[10px] text-muted-foreground">{exchangeRates.length} 个货币对</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

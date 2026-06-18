"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DollarSign, AlertTriangle, Calculator, TrendingUp, Download, FileText, ArrowUpRight, ArrowDownRight,
  Wallet, Receipt, Landmark, PiggyBank, RefreshCw, CheckCircle2, Clock, XCircle
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  overdue: "bg-red-50 text-red-700 border-red-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-green-50 text-green-700 border-green-200",
};

const TABS = [
  { id: "arap", label: "应收应付", icon: Wallet },
  { id: "landed", label: "到岸成本", icon: Calculator },
  { id: "fx", label: "汇率", icon: TrendingUp },
  { id: "tax", label: "退税管理", icon: PiggyBank },
];

export default function FinancePage() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState("arap");

  useEffect(() => { fetch("/api/finance").then(r => r.json()).then(setData); }, []);

  if (!data) return <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2"><DollarSign className="h-5 w-5 animate-pulse" />加载财务数据...</div>;

  const { receivables, landedCosts, fxRates } = data;
  const totalBalance = receivables?.reduce((s: number, r: any) => s + r.balance, 0) || 0;
  const overdueCount = receivables?.filter((r: any) => r.status === "overdue").length || 0;
  const pendingCount = receivables?.filter((r: any) => r.status === "pending").length || 0;

  const statusIcon = (s: string) => {
    if (s === "overdue") return XCircle;
    if (s === "partial") return Clock;
    if (s === "pending") return Clock;
    return CheckCircle2;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">财务管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">应收应付 · 到岸成本 · 汇率 · 退税</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetch("/api/finance").then(r => r.json()).then(setData)}>
            <RefreshCw className="h-4 w-4 mr-1.5" />刷新
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                tab === t.id ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Tab: 应收应付 */}
      {tab === "arap" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: DollarSign, value: `$${totalBalance.toLocaleString()}`, label: "应收余额", color: "text-green-600", bg: "bg-green-50" },
              { icon: AlertTriangle, value: overdueCount, label: "逾期笔数", color: "text-red-600", bg: "bg-red-50" },
              { icon: Clock, value: pendingCount, label: "待收款", color: "text-blue-600", bg: "bg-blue-50" },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", s.bg)}><s.icon className={cn("h-6 w-6", s.color)} /></div>
                  <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-2">
            {receivables?.map((r: any) => {
              const SIcon = statusIcon(r.status);
              return (
                <Card key={r.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", STATUS_STYLES[r.status] || "bg-gray-50")}>
                        <SIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{r.customer} <span className="text-muted-foreground font-normal">{r.orderNo}</span></p>
                        <p className="text-xs text-muted-foreground">
                          应付: ${r.total.toLocaleString()} · 定金: ${r.deposit.toLocaleString()} · 到期: {r.dueDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={STATUS_STYLES[r.status]}>
                        {{ overdue: "逾期", partial: "部分收款", pending: "待收款", paid: "已结清" }[r.status] || r.status}
                      </Badge>
                      <span className={cn("font-semibold text-sm", r.balance > 0 ? "text-red-600" : "text-green-600")}>
                        ${r.balance.toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: 到岸成本 */}
      {tab === "landed" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Calculator, value: `$${landedCosts?.reduce((s: number, l: any) => s + l.totalExtra, 0).toLocaleString() || 0}`, label: "总附加成本", color: "text-indigo-600", bg: "bg-indigo-50" },
              { icon: Receipt, value: landedCosts?.length || 0, label: "已核算订单", color: "text-purple-600", bg: "bg-purple-50" },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", s.bg)}><s.icon className={cn("h-6 w-6", s.color)} /></div>
                  <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-2">
            {landedCosts?.map((l: any) => (
              <Card key={l.orderId}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <p className="font-semibold text-sm">{l.orderNo}</p>
                    <Badge variant="outline" className="font-mono">{l.currency} {l.totalExtra.toLocaleString()}</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center text-xs">
                    {[
                      { label: "运费", value: l.freight, color: "text-blue-600" },
                      { label: "保险", value: l.insurance, color: "text-green-600" },
                      { label: "关税", value: l.tariff, color: "text-amber-600" },
                      { label: "港杂", value: l.portCharges, color: "text-purple-600" },
                    ].map((c, i) => (
                      <div key={i} className="p-2 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">{c.label}</p>
                        <p className={cn("font-semibold", c.color)}>${c.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab: 汇率 */}
      {tab === "fx" && (
        <div className="space-y-5">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-6">
                {fxRates?.map((fx: any, i: number) => (
                  <div key={i} className="text-center p-6 bg-gradient-to-br from-muted/50 to-muted rounded-xl border">
                    <p className="text-sm text-muted-foreground mb-1">{fx.from} → {fx.to}</p>
                    <p className="text-3xl font-bold tracking-tight">{fx.rate}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                      <RefreshCw className="h-3 w-3" />{fx.date}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-3 text-xs text-blue-700 flex items-start gap-2">
              <Landmark className="h-4 w-4 shrink-0 mt-0.5" />
              汇率数据来源: ECB 欧洲央行 · 每日更新 · 支持手动覆盖
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: 退税管理 */}
      {tab === "tax" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: PiggyBank, value: "2", label: "待申报", color: "text-indigo-600", bg: "bg-indigo-50" },
              { icon: DollarSign, value: "$3,245", label: "预估退税", color: "text-green-600", bg: "bg-green-50" },
              { icon: CheckCircle2, value: "85%", label: "完成率", color: "text-blue-600", bg: "bg-blue-50" },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", s.bg)}><s.icon className={cn("h-6 w-6", s.color)} /></div>
                  <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">退税申报记录</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { order: "ORD-2026-088", customer: "BestBuy Co.", amount: "$1,245", status: "申报中", cls: "bg-amber-50 text-amber-700" },
                { order: "ORD-2026-089", customer: "EuroTech GmbH", amount: "$2,000", status: "资料准备", cls: "bg-blue-50 text-blue-700" },
              ].map((r, i) => (
                <Card key={i} className="bg-muted/20">
                  <CardContent className="p-3 flex justify-between items-center">
                    <div><p className="font-medium text-sm">{r.order}</p><p className="text-xs text-muted-foreground">{r.customer} · 应退 {r.amount}</p></div>
                    <Badge className={r.cls}>{r.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              <FileText className="h-6 w-6 mx-auto mb-1" />
              <p>退税资料管理</p>
              <p className="text-xs mt-1">上传出口报关单、增值税发票等退税资料</p>
              <Button variant="outline" size="sm" className="mt-2 h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1" />上传资料
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

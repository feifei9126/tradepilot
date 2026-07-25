"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calculator,
  DollarSign,
  FileText,
  Loader2,
  PiggyBank,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { addCurrencyTotal, formatCurrencyTotals } from "@/lib/currency";

interface Receivable {
  id: string;
  orderNo: string;
  customer: string;
  total: number;
  currency: string;
  paid: number;
  balance: number;
  dueDate: string;
  status: "untracked";
}

interface FinanceData {
  source: "orders";
  accountingConfigured: false;
  receivables: Receivable[];
  landedCosts: [];
  taxRecords: [];
}

type FinanceTab = "arap" | "landed" | "tax";

const TABS = [
  { id: "arap" as const, label: "订单对账", icon: Wallet },
  { id: "landed" as const, label: "到岸成本", icon: Calculator },
  { id: "tax" as const, label: "退税管理", icon: PiggyBank },
];

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [tab, setTab] = useState<FinanceTab>("arap");
  const [loading, setLoading] = useState(true);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/finance");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "财务数据加载失败");
      setData(result);
    } catch (error: unknown) {
      setData(null);
      toast.error(error instanceof Error ? error.message : "财务数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFinance();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFinance]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        加载财务数据...
      </div>
    );
  }

  const receivables = data?.receivables || [];
  const orderTotals = receivables.reduce<Record<string, number>>(
    (totals, item) => addCurrencyTotal(totals, item.total, item.currency),
    {},
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">财务管理</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            订单金额对账、成本与退税资料
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadFinance}
          disabled={loading}
        >
          <RefreshCw
            className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")}
          />
          刷新
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          当前数据来自订单，不包含收款流水、采购成本或税务申报。未接入会计账簿前，系统不会把订单金额冒充为已核实应收。
        </p>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-md bg-muted p-1">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium transition-colors",
                tab === item.id
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "arap" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {formatCurrencyTotals(orderTotals)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    待对账订单金额（未换算）
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-50">
                  <Wallet className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-semibold">{receivables.length}</p>
                  <p className="text-xs text-muted-foreground">
                    未录入收款状态
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            {receivables.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {item.customer}{" "}
                      <span className="font-normal text-muted-foreground">
                        {item.orderNo}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      订单交期: {item.dueDate || "未设置"} · 币种:{" "}
                      {item.currency}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-700"
                    >
                      未对账
                    </Badge>
                    <span className="text-sm font-semibold">
                      {item.currency} {item.total.toLocaleString()}
                    </span>
                    <Button
                      render={<Link href={`/app/orders/${item.id}`} />}
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      查看订单
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "landed" && (
        <EmptyFinanceState
          icon={Calculator}
          title="尚无到岸成本记录"
          description="现有订单和出货记录没有运费、保险、关税与港杂费字段，因此暂不计算附加成本。"
        />
      )}

      {tab === "tax" && (
        <EmptyFinanceState
          icon={FileText}
          title="尚无退税申报记录"
          description="项目尚未接入报关单、发票和退税流水。接入数据模型前不展示估算完成率或虚构申报记录。"
        />
      )}
    </div>
  );
}

function EmptyFinanceState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Calculator;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-10 text-center">
        <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

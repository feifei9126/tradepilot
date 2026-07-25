"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, FileText, ClipboardList, Loader2 } from "lucide-react";
import Link from "next/link";
import type { StoredQuotation } from "@/lib/store";
import { toast } from "sonner";
import { formatMoney } from "@/lib/currency";

type QuotationWithOrder = StoredQuotation & { orderId?: string | null };

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  sent: "已发送",
  accepted: "已接受",
  rejected: "已拒绝",
  expired: "已过期",
};
const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  sent: "default",
  accepted: "outline",
  rejected: "destructive",
  expired: "secondary",
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/quotations")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data))
          throw new Error("报价数据加载失败");
        setQuotations(data);
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "报价数据加载失败",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      const response = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "报价状态更新失败");
      setQuotations((current) =>
        current.map((quotation) =>
          quotation.id === id
            ? { ...data, orderId: quotation.orderId }
            : quotation,
        ),
      );
      toast.success("报价状态已更新");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "报价状态更新失败");
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = quotations.filter(
    (q) => q.no?.includes(search) || q.contactName?.includes(search),
  );

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">报价</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理报价草稿并人工确认客户接受状态
          </p>
        </div>
        <Button
          render={<Link href="/app/quotations/new" />}
          nativeButton={false}
        >
          <Plus className="h-4 w-4 mr-2" /> 新建报价
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索报价单..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && !loading && (
        <div className="py-16 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mt-2">还没有报价单</p>
          <Button
            render={<Link href="/app/quotations/new" />}
            nativeButton={false}
            variant="outline"
            className="mt-3"
          >
            <Plus className="h-4 w-4 mr-1" /> 创建第一份报价
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((q) => (
          <Card key={q.id}>
            <CardContent className="p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{q.no}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.contactName} · {formatMoney(q.totalAmount, q.currency)}{" "}
                      · {q.tradeTerm}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {q.aiGenerated && (
                    <Badge
                      variant="outline"
                      className="h-5 text-xs border-amber-200 text-amber-700 bg-amber-50"
                    >
                      AI 生成
                    </Badge>
                  )}
                  {updatingId === q.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Select
                      value={q.status}
                      disabled={Boolean(q.orderId)}
                      onValueChange={(value) =>
                        value && void updateStatus(q.id, value)
                      }
                    >
                      <SelectTrigger
                        className="h-8 w-28 text-xs"
                        aria-label={`${q.no} 报价状态`}
                        title={
                          q.orderId ? "已转订单的报价状态不可修改" : undefined
                        }
                      >
                        <SelectValue>
                          {STATUS_LABELS[q.status] || q.status}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Badge variant={STATUS_VARIANTS[q.status] || "outline"}>
                    {STATUS_LABELS[q.status] || q.status}
                  </Badge>
                  {q.orderId ? (
                    <Button
                      render={<Link href={`/app/orders/${q.orderId}`} />}
                      nativeButton={false}
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                    >
                      <ClipboardList className="mr-1 h-3.5 w-3.5" />
                      查看订单
                    </Button>
                  ) : q.status === "accepted" ? (
                    <Button
                      render={
                        <Link
                          href={`/app/orders/new?quotationId=${encodeURIComponent(q.id)}`}
                        />
                      }
                      nativeButton={false}
                      size="sm"
                      className="h-8 text-xs"
                    >
                      <ClipboardList className="mr-1 h-3.5 w-3.5" />
                      转为订单
                    </Button>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {q.createdAt}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

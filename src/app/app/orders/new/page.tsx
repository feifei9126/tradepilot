"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ClipboardList } from "lucide-react";
import Link from "next/link";
import { formatMoney } from "@/lib/currency";

interface Quotation {
  id: string;
  no: string;
  contactId: string;
  contactName: string;
  items: {
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }[];
  totalAmount: number;
  currency: string;
  tradeTerm: string;
  status: string;
  orderId?: string | null;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQId, setSelectedQId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/quotations")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data))
          throw new Error("报价数据加载失败");
        const allQuotations = data as Quotation[];
        const available = allQuotations.filter(
          (quote) => quote.status === "accepted" && !quote.orderId,
        );
        setQuotations(available);
        const search = new URLSearchParams(window.location.search);
        const requestedQuotationId = search.get("quotationId");
        const requestedContactId = search.get("contactId");
        const requestedQuotation = allQuotations.find(
          (quote) => quote.id === requestedQuotationId,
        );
        if (requestedQuotation?.orderId) {
          router.replace(`/app/orders/${requestedQuotation.orderId}`);
          return;
        }
        const requested =
          available.find((quote) => quote.id === requestedQuotationId) ||
          available.find((quote) => quote.contactId === requestedContactId);
        if (requested) setSelectedQId(requested.id);
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "报价数据加载失败",
        ),
      )
      .finally(() => setLoading(false));
  }, [router]);

  const selectedQ = quotations.find((q) => q.id === selectedQId);

  async function handleCreate() {
    if (!selectedQ) {
      toast.error("请选择一份有效报价");
      return;
    }
    setSaving(true);
    try {
      const body = {
        quotationId: selectedQ.id,
        deliveryDate: deliveryDate || "",
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("订单已创建");
        router.push("/app/orders");
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error || "创建失败");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          render={<Link href="/app/orders" />}
          nativeButton={false}
          variant="ghost"
          size="icon"
          aria-label="返回订单列表"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">新建订单</h1>
          <p className="text-sm text-muted-foreground">
            从已确认的报价创建订单
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">选择来源</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quotations.length === 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              暂无可转订单的已接受报价。请先在报价页确认报价状态，已转订单的报价不会重复显示。
              <Link
                href="/app/quotations"
                className="ml-1 font-medium underline underline-offset-2"
              >
                返回报价
              </Link>
            </div>
          )}
          <div>
            <Label>选择报价</Label>
            <Select
              value={selectedQId}
              items={quotations.map((quotation) => ({
                value: quotation.id,
                label: `${quotation.no} - ${quotation.contactName} (${formatMoney(quotation.totalAmount, quotation.currency)})`,
              }))}
              onValueChange={(v) => v && setSelectedQId(v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="选择一份有效报价" />
              </SelectTrigger>
              <SelectContent>
                {quotations.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.no} - {q.contactName} (
                    {formatMoney(q.totalAmount, q.currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedQ && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium">{selectedQ.no}</p>
              <p className="text-muted-foreground">
                客户: {selectedQ.contactName}
              </p>
              <p className="text-muted-foreground">
                金额: {formatMoney(selectedQ.totalAmount, selectedQ.currency)} ·{" "}
                {selectedQ.tradeTerm}
              </p>
              <p className="text-muted-foreground">
                条款: {selectedQ.tradeTerm}
              </p>
            </div>
          )}

          <div>
            <Label>期望交期</Label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={saving || !selectedQ}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ClipboardList className="h-4 w-4 mr-2" />
            )}
            {saving ? "创建中..." : "确认创建订单"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, ClipboardList } from "lucide-react";
import Link from "next/link";

export default function NewOrderPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQId, setSelectedQId] = useState("");
  const [contactName, setContactName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/quotations").then(r => r.json()).then(data => {
      setQuotations(data.filter((q: any) => q.status !== "expired"));
      setLoading(false);
    });
  }, []);

  const selectedQ = quotations.find(q => q.id === selectedQId);

  async function handleCreate() {
    setSaving(true);
    try {
      const body = selectedQ ? {
        contactId: selectedQ.contactId,
        contactName: selectedQ.contactName,
        quotationId: selectedQ.id,
        items: selectedQ.items,
        totalAmount: selectedQ.totalAmount,
        deliveryDate: deliveryDate || "",
      } : {
        contactName: contactName || "手动订单",
        items: [],
        totalAmount: 0,
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
        toast.error("创建失败");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/orders"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-semibold">新建订单</h1>
          <p className="text-sm text-muted-foreground">从报价创建或手动录入订单</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">选择来源</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>从已有报价创建（可选）</Label>
            <Select value={selectedQId} onValueChange={(v) => v && setSelectedQId(v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="选择报价（跳过则手动创建）" /></SelectTrigger>
              <SelectContent>
                {quotations.map(q => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.no} - {q.contactName} (${q.totalAmount?.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedQ && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium">{selectedQ.no}</p>
              <p className="text-muted-foreground">客户: {selectedQ.contactName}</p>
              <p className="text-muted-foreground">金额: ${selectedQ.totalAmount?.toLocaleString()} · {selectedQ.tradeTerm}</p>
              <p className="text-muted-foreground">条款: {selectedQ.tradeTerm}</p>
            </div>
          )}

          {!selectedQ && (
            <div>
              <Label>客户名称（手动）</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="如: New Customer Co." className="mt-1" />
            </div>
          )}

          <div>
            <Label>期望交期</Label>
            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1" />
          </div>

          <Button className="w-full" onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardList className="h-4 w-4 mr-2" />}
            {saving ? "创建中..." : "确认创建订单"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

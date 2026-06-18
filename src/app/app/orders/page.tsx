"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ClipboardList, Plus } from "lucide-react";
import Link from "next/link";

const STATUS_CFG: Record<string, string> = {
  confirmed: "已确认", in_production: "生产中", inspection: "验货中",
  ready: "待发货", shipped: "已发货", completed: "已完成",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/orders").then(r => r.json()).then(data => { setOrders(data); setLoading(false); });
  }, []);

  const filtered = orders.filter(o => o.no?.includes(search) || o.contactName?.includes(search));

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">订单</h1>
          <p className="text-sm text-muted-foreground mt-1">跟踪和管理所有订单</p>
        </div>
        <Link href="/app/orders/new"><Button><Plus className="h-4 w-4 mr-2" /> 新建订单</Button></Link>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索订单..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>还没有订单</p>
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((o) => (
          <Link key={o.id} href={`/app/orders/${o.id}`}>
            <Card className="cursor-pointer hover:bg-muted/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{o.no}</p>
                      <p className="text-xs text-muted-foreground">{o.contactName} · ${o.totalAmount?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{STATUS_CFG[o.status] || o.status}</Badge>
                    {o.deliveryDate && <span className="text-xs text-muted-foreground">交期: {o.deliveryDate}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

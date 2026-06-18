"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Ship, Package, Truck, FileSearch, Anchor, ClipboardCheck, MapPin, Calendar, Container, ArrowRight } from "lucide-react";

const MILESTONE_ICONS: Record<string, any> = {
  "订舱": Ship, "工厂提货": Package, "报关": FileSearch, "装船": Anchor, "清关": ClipboardCheck, "派送": Truck,
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  delivered: { label: "已送达", cls: "bg-green-100 text-green-700" },
  in_transit: { label: "运输中", cls: "bg-blue-100 text-blue-700" },
  processing: { label: "处理中", cls: "bg-amber-100 text-amber-700" },
};

export default function LogisticsPage() {
  const [tracking, setTracking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/logistics").then(r => r.json()).then(d => { setTracking(d); setLoading(false); if (d.length > 0) setExpanded(d[0].id); });
  }, []);

  if (loading) return <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2"><Ship className="h-5 w-5 animate-pulse" />加载物流数据...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">物流跟踪</h1>
          <p className="text-sm text-muted-foreground mt-0.5">订舱 → 提货 → 报关 → 装船 → 清关 → 派送</p>
        </div>
      </div>

      {/* Breadcrumb Path */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {["订舱", "提货", "报关", "装船", "清关", "派送"].map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className="bg-muted px-2 py-0.5 rounded">{s}</span>
            {i < 5 && <ArrowRight className="h-3 w-3" />}
          </span>
        ))}
      </div>

      {/* Tracking Cards */}
      <div className="space-y-4">
        {tracking.map(t => {
          const statusInfo = STATUS_CFG[t.status] || STATUS_CFG.processing;
          const isExpanded = expanded === t.id;
          const doneCount = t.milestones.filter((m: any) => m.status === "done").length;
          const progress = Math.round((doneCount / t.milestones.length) * 100);

          return (
            <Card key={t.id} className="overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b bg-muted/20 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(isExpanded ? null : t.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Container className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{t.orderNo}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.customer}</span>
                      <span className="flex items-center gap-1"><Container className="h-3 w-3" />{t.containerNo}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Progress Bar */}
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{progress}%</span>
                  </div>
                  <Badge className={statusInfo.cls}>{statusInfo.label}</Badge>
                </div>
              </div>

              {/* Milestones */}
              {isExpanded && (
                <div className="p-6">
                  <div className="relative">
                    {t.milestones.map((m: any, i: number) => {
                      const Icon = MILESTONE_ICONS[m.name] || Ship;
                      const done = m.status === "done";
                      return (
                        <div key={i} className="flex gap-4 pb-8 relative last:pb-0">
                          {i < t.milestones.length - 1 && (
                            <div className={cn("absolute left-5 top-10 w-0.5 h-[calc(100%-20px)]", done ? "bg-green-300" : "bg-gray-200")} />
                          )}
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2",
                            done ? "bg-green-50 border-green-400" : "bg-gray-50 border-gray-300"
                          )}>
                            <Icon className={cn("h-5 w-5", done ? "text-green-600" : "text-gray-400")} />
                          </div>
                          <div className="flex-1 pt-1">
                            <div className="flex items-center justify-between">
                              <p className={cn("font-medium", done ? "text-gray-900" : "text-gray-500")}>{m.name}</p>
                              <span className="text-xs text-muted-foreground">{m.date || ""}</span>
                            </div>
                            {m.note && <p className="text-sm text-muted-foreground mt-1">{m.note}</p>}
                            {!done && <p className="text-xs text-amber-600 mt-1">⏳ 待处理</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

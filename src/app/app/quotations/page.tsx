"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Sparkles } from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = { draft: "草稿", sent: "已发送", accepted: "已接受", rejected: "已拒绝", expired: "已过期" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = { draft: "secondary", sent: "default", accepted: "outline", rejected: "destructive", expired: "secondary" };

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/quotations").then(r => r.json()).then(data => {
      setQuotations(data);
      setLoading(false);
    });
  }, []);

  const filtered = quotations.filter(q => q.no?.includes(search) || q.contactName?.includes(search));

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">报价</h1>
          <p className="text-sm text-muted-foreground mt-1">管理报价单</p>
        </div>
        <Link href="/app/quotations/new">
          <Button><Plus className="h-4 w-4 mr-2" /> 新建报价</Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索报价单..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 && !loading && (
        <div className="py-16 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mt-2">还没有报价单</p>
          <Link href="/app/quotations/new">
            <Button variant="outline" className="mt-3"><Plus className="h-4 w-4 mr-1" /> 创建第一份报价</Button>
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((q) => (
          <Card key={q.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{q.no}</p>
                    <p className="text-xs text-muted-foreground">{q.contactName} · ${q.totalAmount?.toLocaleString()} · {q.tradeTerm}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {q.aiGenerated && <Badge variant="outline" className="h-5 text-xs border-amber-200 text-amber-700 bg-amber-50">AI 生成</Badge>}
                  <Badge variant={STATUS_VARIANTS[q.status] || "outline"}>{STATUS_LABELS[q.status] || q.status}</Badge>
                  <span className="text-xs text-muted-foreground">{q.createdAt}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

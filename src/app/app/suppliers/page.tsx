"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Star, MapPin, Plus } from "lucide-react";
import Link from "next/link";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { fetch("/api/suppliers").then(r => r.json()).then(setSuppliers); }, []);

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.products?.some((p: string) => p.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">供应商</h1><p className="text-sm text-muted-foreground">管理你的供应链</p></div>
        <Button onClick={() => { const n = prompt("供应商名称"); if (n) fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) }).then(() => location.reload()); }}><Plus className="h-4 w-4 mr-1" />新增</Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input placeholder="搜索供应商或产品..." className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(s => (
          <Link key={s.id} href={"/app/suppliers/" + s.id}>
            <Card className="hover:bg-muted/30 transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2"><Building2 className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.contactName} · {s.phone || s.email || "-"}</p>
                    {s.country && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{s.country}</p>}
                    <div className="flex items-center gap-1 mt-1">
                      {s.rating && Array.from({ length: 5 }).map((_, i) => (<Star key={i} className={`h-3 w-3 ${i < s.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />))}
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {s.products?.map((p: string) => <Badge key={p} variant="secondary" className="h-5 text-xs">{p}</Badge>)}
                      {s.tags?.map((t: string) => <Badge key={t} variant="outline" className="h-5 text-xs">{t}</Badge>)}
                    </div>
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

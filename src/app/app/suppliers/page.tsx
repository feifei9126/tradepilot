"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Building2, Star, MapPin, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import type { StoredSupplier } from "@/lib/store";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<StoredSupplier[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    country: "中国",
  });
  useEffect(() => {
    fetch("/api/suppliers")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data))
          throw new Error("供应商数据加载失败");
        setSuppliers(data);
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "供应商数据加载失败",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = suppliers.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.products?.some((p: string) =>
        p.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  async function handleAdd() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "供应商创建失败");
      setSuppliers((current) => [...current, data]);
      setForm({
        name: "",
        contactName: "",
        phone: "",
        email: "",
        country: "中国",
      });
      setAddOpen(false);
      toast.success("供应商已创建");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "供应商创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">供应商</h1>
          <p className="text-sm text-muted-foreground">管理你的供应链</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          新增
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索供应商或产品..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((s) => (
          <Link key={s.id} href={"/app/suppliers/" + s.id}>
            <Card className="hover:bg-muted/30 transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.contactName} · {s.phone || s.email || "-"}
                    </p>
                    {s.country && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {s.country}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      {s.rating &&
                        Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < (s.rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                          />
                        ))}
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {s.products?.map((p: string) => (
                        <Badge
                          key={p}
                          variant="secondary"
                          className="h-5 text-xs"
                        >
                          {p}
                        </Badge>
                      ))}
                      {s.tags?.map((t: string) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="h-5 text-xs"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground md:col-span-2">
            暂无供应商
          </p>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增供应商</DialogTitle>
            <DialogDescription>录入供应商及主要联系人信息。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="supplier-name">供应商名称 *</Label>
              <Input
                id="supplier-name"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-contact">联系人</Label>
              <Input
                id="supplier-contact"
                value={form.contactName}
                onChange={(event) =>
                  setForm({ ...form, contactName: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-country">国家或地区</Label>
              <Input
                id="supplier-country"
                value={form.country}
                onChange={(event) =>
                  setForm({ ...form, country: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-phone">电话</Label>
              <Input
                id="supplier-phone"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-email">邮箱</Label>
              <Input
                id="supplier-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleAdd} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存供应商
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

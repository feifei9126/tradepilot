"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Star, Package, FileText } from "lucide-react";
import type { StoredSupplier } from "@/lib/store";
import { toast } from "sonner";

export default function SupplierDetailPage() {
  const params = useParams();
  const [supplier, setSupplier] = useState<StoredSupplier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/suppliers")
      .then(async (response) => {
        const list = await response.json();
        if (!response.ok || !Array.isArray(list))
          throw new Error("供应商数据加载失败");
        setSupplier(
          (list as StoredSupplier[]).find((item) => item.id === params.id) ||
            null,
        );
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "供应商数据加载失败",
        ),
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );
  if (!supplier)
    return (
      <div className="p-8 text-center text-muted-foreground">供应商不存在</div>
    );

  return (
    <div className="space-y-5">
      <Button
        render={<Link href="/app/suppliers" />}
        nativeButton={false}
        variant="ghost"
        size="sm"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        返回
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold">{supplier.name}</h1>
            <p className="text-sm text-muted-foreground">
              {supplier.country} · {supplier.category || "未分类"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i <= (supplier.rating || 3) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
              />
            ))}
          </div>
          <Badge
            variant={supplier.isActive === false ? "secondary" : "outline"}
          >
            {supplier.isActive === false
              ? "已停用"
              : supplier.isActive === true
                ? "合作中"
                : "已录入"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-1" />
            供应产品
          </TabsTrigger>
          <TabsTrigger value="orders">
            <FileText className="h-4 w-4 mr-1" />
            采购记录
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">联系人</p>
                <p className="font-medium">{supplier.contactName || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">电话</p>
                <p className="font-medium">{supplier.phone || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">邮箱</p>
                <p className="font-medium">{supplier.email || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">国家/地区</p>
                <p className="font-medium">{supplier.country || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">付款条件</p>
                <p className="font-medium">{supplier.paymentTerms || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">交期(天)</p>
                <p className="font-medium">{supplier.leadTimeDays || "—"}</p>
              </div>
            </CardContent>
          </Card>
          {(supplier.tags?.length || 0) > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-2">标签</p>
                <div className="flex gap-1.5 flex-wrap">
                  {supplier.tags?.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {supplier.notes && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-1">备注</p>
                <p className="text-sm text-muted-foreground">
                  {supplier.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">供应的产品</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-6 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>暂无产品关联</p>
                <p className="mt-2 text-xs">
                  产品关联功能将在采购模块接入后开放。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">采购记录</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-6 text-center text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>暂无采购记录</p>
                <p className="mt-2 text-xs">
                  采购单模块尚未接入，当前不会创建空白采购单。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

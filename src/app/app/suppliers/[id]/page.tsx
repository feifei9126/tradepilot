"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Phone, Mail, Globe, Star, Tag, Package, FileText, Plus } from "lucide-react";
import { toast } from "sonner";

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/suppliers").then(r => r.json()).then((list: any[]) => {
      const s = list.find((item: any) => item.id === params.id);
      setSupplier(s);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  if (!supplier) return <div className="p-8 text-center text-muted-foreground">供应商不存在</div>;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-1" />返回</Button>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{supplier.name}</h1>
            <p className="text-sm text-muted-foreground">{supplier.country} · {supplier.category || "未分类"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex">{[1,2,3,4,5].map(i => <Star key={i} className={`h-4 w-4 ${i <= (supplier.rating || 3) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />)}</div>
          <Badge variant={supplier.isActive === false ? "secondary" : "default"}>
            {supplier.isActive === false ? "已停用" : "合作中"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="products"><Package className="h-4 w-4 mr-1" />供应产品</TabsTrigger>
          <TabsTrigger value="orders"><FileText className="h-4 w-4 mr-1" />采购记录</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">联系人</p><p className="font-medium">{supplier.contactName || "—"}</p></div>
              <div><p className="text-muted-foreground">电话</p><p className="font-medium">{supplier.phone || "—"}</p></div>
              <div><p className="text-muted-foreground">邮箱</p><p className="font-medium">{supplier.email || "—"}</p></div>
              <div><p className="text-muted-foreground">国家/地区</p><p className="font-medium">{supplier.country || "—"}</p></div>
              <div><p className="text-muted-foreground">付款条件</p><p className="font-medium">{supplier.paymentTerms || "T/T"}</p></div>
              <div><p className="text-muted-foreground">交期(天)</p><p className="font-medium">{supplier.leadTimeDays || "—"}</p></div>
            </CardContent>
          </Card>
          {supplier.tags?.length > 0 && (
            <Card><CardContent className="p-4"><p className="text-sm font-medium mb-2">标签</p><div className="flex gap-1.5 flex-wrap">{supplier.tags.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}</div></CardContent></Card>
          )}
          {supplier.notes && <Card><CardContent className="p-4"><p className="text-sm font-medium mb-1">备注</p><p className="text-sm text-muted-foreground">{supplier.notes}</p></CardContent></Card>}
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">供应的产品</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-6 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>暂无产品关联</p>
                <Button variant="outline" size="sm" className="mt-2"><Plus className="h-3 w-3 mr-1" />关联产品</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">采购记录</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-6 text-center text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>暂无采购记录</p>
                <Button variant="outline" size="sm" className="mt-2"><Plus className="h-3 w-3 mr-1" />创建采购单</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

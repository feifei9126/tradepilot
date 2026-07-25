"use client";

import { useState, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FirecrawlImportDialog,
  type FirecrawlImportedProduct,
} from "@/components/firecrawl/firecrawl-import-dialog";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus,
  Search,
  Package,
  Globe,
  Loader2,
  Download,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Product = FirecrawlImportedProduct;

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data))
          throw new Error("产品数据加载失败");
        if (!cancelled) setProducts(data);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          toast.error(
            error instanceof Error ? error.message : "产品数据加载失败",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("import") !== "1")
      return;
    const timer = window.setTimeout(() => setImportOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.modelNo?.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/products/export");
      if (!res.ok) throw new Error("产品数据导出失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "products.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("产品数据已导出");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "产品数据导出失败");
    } finally {
      setExporting(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">产品</h1>
          <p className="text-sm text-muted-foreground mt-1">管理你的产品目录</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Download className="h-3 w-3 mr-1" />
            )}
            导出CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Globe className="h-4 w-4 mr-2" />
            Firecrawl 抓取
          </Button>
          <FirecrawlImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            onImported={(product) =>
              setProducts((current) => [product, ...current])
            }
          />
          <Link
            href="/app/products/new"
            className={cn(buttonVariants(), "h-9")}
          >
            <Plus className="h-4 w-4 mr-2" /> 新增产品
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索产品名称或型号..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => (
          <Card
            key={product.id}
            className="transition-colors hover:bg-muted/50"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {product.media?.find((item) => item.type === "image") ? (
                  <img
                    src={
                      product.media.find((item) => item.type === "image")!.url
                    }
                    alt={`${product.name || "产品"} 图片`}
                    className="h-14 w-14 shrink-0 rounded-md border bg-muted object-cover"
                  />
                ) : (
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.modelNo}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {product.hsCode}
                    </Badge>
                    <span>
                      成本 ¥{product.costPrice}/{product.unit}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    MOQ: {product.moq} {product.unit}
                  </p>
                  {product.source?.startsWith("http") && (
                    <p className="text-xs text-blue-500 mt-1 truncate">
                      {product.source}
                    </p>
                  )}
                  <div className="mt-3">
                    <Link
                      href={`/app/product-video?productId=${encodeURIComponent(product.id)}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "h-7 text-xs",
                      )}
                    >
                      <Video className="h-3.5 w-3.5 mr-1" />
                      生成产品视频
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

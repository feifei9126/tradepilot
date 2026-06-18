"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Search, Package, Globe, Loader2, ExternalLink, Check, Download } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";

const PLATFORMS = [
  { id: "shopify", name: "Shopify" },
  { id: "woocommerce", name: "WooCommerce" },
  { id: "aliexpress", name: "AliExpress" },
  { id: "amazon", name: "Amazon" },
  { id: "other", name: "其他网站" },
];

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importPlatform, setImportPlatform] = useState("shopify");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const { config } = useAIConfig();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(data => { setProducts(data); setLoading(false); });
  }, []);

  async function handleImport() {
    if (!importUrl.trim()) { toast.error("请输入产品链接"); return; }
    const provider = config.taskMapping?.quotation || "deepseek:deepseek-chat";
    const [pid, m] = provider.split(":");
    const pcfg = config.providers[pid];

    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: importUrl,
          platform: importPlatform,
          apiKey: pcfg?.apiKey || "",
          provider: pid,
          model: m,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data.product || data);
        toast.success("产品导入成功！");
        fetch("/api/products").then(r => r.json()).then(setProducts);
      } else {
        toast.error(data.error || "导入失败");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  }

  function confirmImport() {
    toast.success("产品已添加到目录");
    setImportOpen(false);
    setImportResult(null);
    setImportUrl("");
  }

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.modelNo?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleExport() {
    setExporting(true);
    const res = await fetch("/api/products/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "products.csv"; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">产品</h1>
          <p className="text-sm text-muted-foreground mt-1">管理你的产品目录</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
            导出CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Globe className="h-4 w-4 mr-2" />从网站导入
          </Button>
          <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) { setImportResult(null); setImportUrl(""); }}}>
            
<DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>从网站导入产品</DialogTitle>
                <DialogDescription>输入产品链接，AI 自动提取产品信息并添加到目录</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>平台</Label>
                  <Select value={importPlatform} onValueChange={(v) => v && setImportPlatform(v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>产品链接</Label>
                  <Input
                    placeholder="https://example.com/products/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">支持 Shopify、WooCommerce、AliExpress、Amazon 等主流独立站</p>
                </div>
                <Button onClick={handleImport} disabled={importing} className="w-full">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                  {importing ? "正在抓取..." : "开始抓取"}
                </Button>

                {importResult && (
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium">📦 导入预览</p>
                    <div className="flex items-start gap-3 bg-muted p-3 rounded-lg">
                      <Package className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">{importResult.name || "产品"}</p>
                        {importResult.modelNo && <p className="text-xs text-muted-foreground">型号: {importResult.modelNo}</p>}
                        {importResult.costPrice && <p className="text-xs text-muted-foreground">价格: ¥{importResult.costPrice}/{importResult.unit || "件"}</p>}
                        {importResult.hsCode && <Badge variant="outline" className="text-xs mt-1">{importResult.hsCode}</Badge>}
                        {importResult.note && <p className="text-xs text-amber-600 mt-2">{importResult.note}</p>}
                      </div>
                    </div>
                    <Button onClick={confirmImport} className="w-full">
                      <Check className="h-4 w-4 mr-2" /> 确认添加到目录
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Link href="/app/products/new"><Button><Plus className="h-4 w-4 mr-2" /> 新增产品</Button></Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索产品名称或型号..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => (
          <Card key={product.id} className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.modelNo}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{product.hsCode}</Badge>
                    <span>成本 ¥{product.costPrice}/{product.unit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">MOQ: {product.moq} {product.unit}</p>
                  {product.source?.startsWith("http") && (
                    <p className="text-xs text-blue-500 mt-1 truncate">{product.source}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

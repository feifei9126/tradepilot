"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Save } from "lucide-react";
import Link from "next/link";
import { useAIConfig } from "@/hooks/useAIConfig";

interface Contact { id: string; name: string; country?: string; }
interface Product { id: string; name: string; modelNo?: string; costPrice?: number; unit: string; }
interface QuoteItem { productId?: string; productName: string; quantity: number; unit: string; unitPrice: number; amount: number; }

export default function NewQuotationPage() {
  const router = useRouter();
  const { getTaskProvider } = useAIConfig();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedContact, setSelectedContact] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string; qty: number }[]>([]);
  const [tradeTerm, setTradeTerm] = useState("FOB");
  const [country, setCountry] = useState("");

  // AI quotation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ items: QuoteItem[]; total: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/contacts").then(r => r.json()),
      fetch("/api/products").then(r => r.json()),
    ]).then(([contactsData, productsData]) => {
      setContacts(contactsData);
      setProducts(productsData);
      setLoading(false);
    });
  }, []);

  const contactName = contacts.find(c => c.id === selectedContact)?.name || "";

  function handleAddProduct(id: string) {
    if (selectedProducts.find(p => p.productId === id)) return;
    setSelectedProducts(prev => [...prev, { productId: id, qty: 100 }]);
  }

  function handleRemoveProduct(id: string) {
    setSelectedProducts(prev => prev.filter(p => p.productId !== id));
  }

  function handleQtyChange(id: string, qty: number) {
    setSelectedProducts(prev => prev.map(p => p.productId === id ? { ...p, qty } : p));
  }

  async function handleAIGenerate() {
    if (!selectedContact) { toast.error("请先选择客户"); return; }
    if (selectedProducts.length === 0) { toast.error("请至少选择一个产品"); return; }
    if (!getTaskProvider("quotation")) { toast.error("请先在设置中配置 AI 提供商"); return; }

    setAiLoading(true);
    setAiResult(null);
    try {
      const aiConfig = getTaskProvider("quotation")!;
      const productInfo = selectedProducts.map(sp => {
        const p = products.find(pr => pr.id === sp.productId);
        return { name: p?.name || "未知", qty: sp.qty, costPrice: p?.costPrice };
      });

      const res = await fetch("/api/ai/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: aiConfig.apiKey,
          provider: aiConfig.providerId,
          model: aiConfig.model,
          productInfo,
          customerName: contactName,
          country: country || contacts.find(c => c.id === selectedContact)?.country || "未知",
          tradeTerm,
        }),
      });

      const data = await res.json();
      if (res.ok && data.quotation) {
        setAiResult({
          items: data.quotation.items || [],
          total: data.quotation.total || 0,
        });
        toast.success("AI 报价生成成功！");
      } else {
        toast.error(data.error || "AI 生成失败，请重试");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    if (!aiResult) return;
    setSaving(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact,
          contactName,
          items: aiResult.items,
          totalAmount: aiResult.total,
          tradeTerm,
          aiGenerated: true,
        }),
      });
      if (res.ok) {
        toast.success("报价单已保存！");
        router.push("/app/quotations");
      } else {
        toast.error("保存失败");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/quotations">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">新建报价</h1>
          <p className="text-sm text-muted-foreground mt-1">选择客户和产品，AI 自动生成专业报价</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">客户信息</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>客户</Label>
                <Select value={selectedContact} onValueChange={(v) => { setSelectedContact(v || ""); setCountry(contacts.find(c => c.id === v)?.country || ""); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="选择客户..." /></SelectTrigger>
                  <SelectContent>
                    {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.country ? `(${c.country})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>目标市场（国家）</Label>
                <Input placeholder="如: 美国" value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>贸易术语</Label>
                <Select value={tradeTerm} onValueChange={(v) => v && setTradeTerm(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOB">FOB</SelectItem>
                    <SelectItem value="CIF">CIF</SelectItem>
                    <SelectItem value="EXW">EXW</SelectItem>
                    <SelectItem value="DDP">DDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">选择产品</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {products.map(p => (
                  <Button key={p.id} variant={selectedProducts.find(sp => sp.productId === p.id) ? "secondary" : "outline"} size="sm"
                    onClick={() => handleAddProduct(p.id)} disabled={!!selectedProducts.find(sp => sp.productId === p.id)}
                    className="text-xs">
                    {p.name}
                  </Button>
                ))}
              </div>
              {selectedProducts.length === 0 && <p className="text-xs text-muted-foreground">点击上方产品添加到报价</p>}
              {selectedProducts.map(sp => {
                const p = products.find(pr => pr.id === sp.productId);
                return (
                  <div key={sp.productId} className="flex items-center justify-between rounded border p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p?.name}</p>
                      <p className="text-xs text-muted-foreground">成本价: ¥{p?.costPrice}/{p?.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} value={sp.qty}
                        onChange={(e) => handleQtyChange(sp.productId, parseInt(e.target.value) || 1)}
                        className="w-20 h-8 text-xs" />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveProduct(sp.productId)}>
                        <span className="text-xs text-muted-foreground">✕</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleAIGenerate} disabled={aiLoading || selectedProducts.length === 0 || !selectedContact}>
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {aiLoading ? "AI 正在生成报价..." : "AI 生成报价"}
          </Button>
        </div>

        {/* Right: AI Result */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI 报价预览
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!aiResult && !aiLoading && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>选择客户和产品后，点击"AI 生成报价"</p>
                  <p className="text-xs mt-1">AI 会结合成本、运费和市场价格生成完整报价</p>
                </div>
              )}
              {aiLoading && (
                <div className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">正在通过 DeepSeek 生成报价...</p>
                </div>
              )}
              {aiResult && !aiLoading && (
                <div className="space-y-0">
                  {/* Professional Quotation Document */}
                  <div className="border rounded-lg overflow-hidden">
                    {/* Letterhead */}
                    <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-primary">QUOTATION</p>
                          <p className="text-xs text-muted-foreground">报价单 · {new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">报价单号</p>
                          <p className="text-sm font-medium">QTN-{Date.now().toString().slice(-6)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 border-b text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">致</p>
                        <p className="font-medium">{contactName}</p>
                        <p className="text-xs text-muted-foreground">{country || contacts.find(c => c.id === selectedContact)?.country || ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-0.5">贸易术语</p>
                        <p className="font-medium">{tradeTerm}</p>
                        <p className="text-xs text-muted-foreground">有效期: {new Date(Date.now() + 15*86400000).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="p-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left pb-2 font-medium">#</th>
                            <th className="text-left pb-2 font-medium">产品</th>
                            <th className="text-right pb-2 font-medium">数量</th>
                            <th className="text-right pb-2 font-medium">单价 (USD)</th>
                            <th className="text-right pb-2 font-medium">金额 (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiResult.items.map((item, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2 text-muted-foreground">{i + 1}</td>
                              <td className="py-2 font-medium">{item.productName}</td>
                              <td className="py-2 text-right">{item.quantity} {item.unit}</td>
                              <td className="py-2 text-right">${item.unitPrice?.toFixed(2)}</td>
                              <td className="py-2 text-right font-medium">${item.amount?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="border-t bg-muted/10 p-4">
                      <div className="space-y-1 text-sm ml-auto max-w-[250px]">
                        <div className="flex justify-between"><span className="text-muted-foreground">小计</span><span>${(aiResult.items.reduce((s: number, i: any) => s + (i.amount || 0), 0)).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">运费</span><span className="text-green-600">已包含</span></div>
                        <div className="flex justify-between text-base font-bold border-t pt-1"><span>总计</span><span className="text-primary">US$ {aiResult.total?.toFixed(2) || "0.00"}</span></div>
                      </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="border-t bg-amber-50/50 p-3 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-amber-800 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI 报价分析
                      </p>
                      <p>• 报价基于市场行情和成本加成法生成</p>
                      <p>• 建议在最终发送前根据客户关系和订单量调整价格</p>
                      <p>• 大客户可提供 3-5% 折扣以促进成交</p>
                    </div>
                  </div>

                  <Button className="w-full mt-3" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {saving ? "保存中..." : "保存报价单"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

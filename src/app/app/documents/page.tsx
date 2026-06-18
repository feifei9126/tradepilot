"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileText, Download, Plus, CheckCircle, History, Eye, Loader2, Trash2,
  FileSpreadsheet, ScrollText, Ship, Earth, FlaskConical, Search, Clock, ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DOC_TYPES = [
  { id: "commercial_invoice", label: "商业发票", abbr: "CI", icon: FileText, desc: "Commercial Invoice", color: "blue" },
  { id: "packing_list", label: "装箱单", abbr: "PL", icon: FileSpreadsheet, desc: "Packing List", color: "green" },
  { id: "bill_of_lading", label: "提单 B/L", abbr: "BL", icon: Ship, desc: "Bill of Lading", color: "amber" },
  { id: "certificate_of_origin", label: "产地证 C/O", abbr: "CO", icon: ScrollText, desc: "Certificate of Origin", color: "purple" },
  { id: "msds", label: "MSDS", abbr: "MSDS", icon: FlaskConical, desc: "Material Safety Data Sheet", color: "rose" },
];

const COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-green-50 text-green-700 border-green-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

const MOCK_ORDERS = [
  { id: "o1", no: "ORD-2026-088", customer: "BestBuy Co.", amount: 12500 },
  { id: "o2", no: "ORD-2026-089", customer: "EuroTech GmbH", amount: 17500 },
  { id: "o3", no: "ORD-2026-090", customer: "Sakura Trading", amount: 1600 },
];

const GENERATED = [
  { id: "d1", type: "commercial_invoice", orderNo: "ORD-2026-088", v: 2, status: "generated", date: "2026-06-01" },
  { id: "d2", type: "packing_list", orderNo: "ORD-2026-088", v: 1, status: "generated", date: "2026-06-01" },
  { id: "d3", type: "commercial_invoice", orderNo: "ORD-2026-089", v: 1, status: "draft", date: "2026-05-28" },
  { id: "d4", type: "bill_of_lading", orderNo: "ORD-2026-090", v: 1, status: "draft", date: "2026-06-03" },
];

export default function DocumentsPage() {
  const [tab, setTab] = useState<"generate" | "list">("generate");
  const [selOrder, setSelOrder] = useState(MOCK_ORDERS[0].id);
  const [selType, setSelType] = useState(DOC_TYPES[0].id);
  const [generating, setGenerating] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [previewDocInfo, setPreviewDocInfo] = useState<{order?: string; type?: string}>({});
  const [generatedDocs, setGeneratedDocs] = useState<any[]>(GENERATED);
  const [managing, setManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function generateDocContent(doc: any): { html: string; filename: string } {
    const dt = DOC_TYPES.find(t => t.id === doc.type);
    const order = MOCK_ORDERS.find(o => o.no === doc.orderNo);
    const typeName = dt?.label || doc.type;
    const filename = `${doc.type}_${doc.orderNo}_v${doc.v}.html`;

    const items = [
      { desc: "Electronic Component TP-1001", qty: 500, unit: "pcs", price: 12.50 },
      { desc: "Sensor Module TP-2000", qty: 200, unit: "pcs", price: 8.00 },
    ];
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

    const html = `<html><head><meta charset="utf-8"><style>
      body { font-family: 'Times New Roman', serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
      h1 { text-align: center; font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 2px; }
      .header { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 12px; }
      .box { border: 1px solid #ccc; padding: 12px; margin-bottom: 16px; font-size: 12px; }
      .box strong { display: block; margin-bottom: 4px; font-size: 11px; color: #666; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
      th { background: #f5f5f5; border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 11px; }
      td { border: 1px solid #ccc; padding: 8px; }
      .total { text-align: right; font-size: 14px; font-weight: bold; margin-top: 16px; }
      .footer { margin-top: 40px; font-size: 11px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 16px; }
    </style></head><body>
      <h1>${typeName}</h1>
      <div class="header">
        <div><strong>Document No:</strong> ${filename.replace('.html','')}</div>
        <div><strong>Date:</strong> ${doc.date || doc.createdAt?.slice(0,10) || new Date().toISOString().slice(0,10)}</div>
      </div>
      <div style="display:flex;gap:16px;margin-bottom:16px">
        <div class="box" style="flex:1"><strong>SELLER</strong>TradePilot Co., Ltd.<br>Shanghai, China</div>
        <div class="box" style="flex:1"><strong>BUYER</strong>${order?.customer || 'N/A'}<br>${order?.customer || ''}</div>
      </div>
      <div class="box"><strong>ORDER REFERENCE</strong>${doc.orderNo}</div>
      <table><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Amount</th></tr>
      ${items.map(i => `<tr><td>${i.desc}</td><td>${i.qty}</td><td>${i.unit}</td><td>$${i.price.toFixed(2)}</td><td>$${(i.qty * i.price).toFixed(2)}</td></tr>`).join('')}
      </table>
      <div class="total">Total Amount: <span style="color:#2563eb">$${subtotal.toFixed(2)}</span></div>
      <div class="footer">This is a computer-generated document. No signature required.</div>
    </body></html>`;
    return { html, filename };
  }

  function doDownload(doc: any) {
    const { html, filename } = generateDocContent(doc);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("下载已开始");
  }

  useEffect(() => { loadGenerated(); }, []);

  async function loadGenerated() {
    try {
      const r = await fetch("/api/documents");
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) setGeneratedDocs(data);
      else if (Array.isArray(data?.documents) && data.documents.length > 0) setGeneratedDocs(data.documents);
    } catch {}
  }

  async function handleDeleteDoc(id: string) {
    if (!confirm("\u786e\u5b9a\u8981\u5220\u9664\u8be5\u5355\u8bc1\u5417\uff1f")) return;
    try {
      const r = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (r.ok) { toast.success("\u5355\u8bc1\u5df2\u5220\u9664"); loadGenerated(); }
      else toast.error("\u5220\u9664\u5931\u8d25");
    } catch { toast.error("\u5220\u9664\u5931\u8d25"); }
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) { toast.error("\u8bf7\u9009\u62e9\u8981\u5220\u9664\u7684\u5355\u8bc1"); return; }
    if (!confirm(`\u786e\u5b9a\u8981\u5220\u9664\u9009\u4e2d\u7684 ${selectedIds.length} \u4efd\u5355\u8bc1\u5417\uff1f`)) return;
    let ok = 0;
    for (const id of selectedIds) {
      try {
        const r = await fetch("/api/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        if (r.ok) ok++;
      } catch {}
    }
    toast.success(`${ok} \u4efd\u5355\u8bc1\u5df2\u5220\u9664`);
    setSelectedIds([]);
    setManaging(false);
    loadGenerated();
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  function doPreview(doc: any) {
    setSelectedDoc(doc);
  }

  const doGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selOrder, type: selType }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`\u2705 ${data.count || 1} 份单证已生成`);
        setTab("list");
        if (data.documents) setGeneratedDocs(prev => [...prev, ...data.documents]);
      } else {
        toast.error("\u751f成失败");
      }
    } catch {
      toast.error("\u751f成失败");
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">单证管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">商业发票 · 装箱单 · 提单 · 产地证 · MSDS</p>
        </div>
      </div>

      {/* Tab Switch */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button onClick={() => setTab("generate")} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", tab === "generate" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <FileText className="h-4 w-4 inline mr-1.5" />生成单证
        </button>
        <button onClick={() => setTab("list")} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", tab === "list" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <History className="h-4 w-4 inline mr-1.5" />已生成
        </button>
      </div>

      {tab === "generate" ? (
        <div className="space-y-6">
          {/* Step 1: 选择订单 */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">1</span>
              选择订单
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {MOCK_ORDERS.map(o => (
                <Card key={o.id}
                  className={cn("cursor-pointer transition-all hover:shadow-md", selOrder === o.id && "ring-2 ring-primary shadow-md")}
                  onClick={() => setSelOrder(o.id)}>
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm">{o.no}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.customer}</p>
                    <p className="text-xs text-muted-foreground">${o.amount.toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Step 2: 选择单证类型 */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">2</span>
              选择单证类型
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {DOC_TYPES.map(t => {
                const Icon = t.icon;
                const active = selType === t.id;
                return (
                  <Card key={t.id}
                    className={cn("cursor-pointer transition-all hover:shadow-md", active && "ring-2 ring-primary shadow-md")}
                    onClick={() => setSelType(t.id)}>
                    <CardContent className={cn("p-4 text-center space-y-2", COLORS[t.color])}>
                      <Icon className="h-6 w-6 mx-auto" />
                      <div>
                        <p className="font-semibold text-sm">{t.abbr}</p>
                        <p className="text-[10px] opacity-80">{t.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => { const o = MOCK_ORDERS.find(x => x.id === selOrder); doPreview({id:"pv",type:selType,orderNo:o?.no||"",v:1,status:"generated",date:new Date().toISOString().slice(0,10)}); }}><Eye className="h-4 w-4 mr-1.5" />预览</Button>
            <Button size="sm" onClick={doGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              {generating ? "生成中..." : "一键生成"}
            </Button>
          </div>
        </div>
      ) : (
        <>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{generatedDocs.length} 份单证</p>
          <div className="flex gap-2">
            {managing ? (
              <>
                <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleBatchDelete}
                  disabled={selectedIds.length === 0}>
                  删除选中 ({selectedIds.length})
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setManaging(false); setSelectedIds([]); }}>
                  完成整理
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setManaging(true)}>
                整理
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {generatedDocs.map(d => {
            const dt = DOC_TYPES.find(t => t.id === d.type);
            const Icon = dt?.icon || FileText;
            const isGen = d.status === "generated";
            return (
              <Card key={d.id} className={`hover:shadow-sm transition-shadow ${managing && selectedIds.includes(d.id) ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {managing && (
                      <input type="checkbox" checked={selectedIds.includes(d.id)}
                        onChange={() => toggleSelect(d.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    )}
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", COLORS[dt?.color || "blue"])}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{dt?.label} — {d.orderNo}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3" />{d.date || d.createdAt?.slice(0, 10)} · v{d.v || 1}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={isGen ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      <CheckCircle className="h-3 w-3 mr-1" />{isGen ? "已生成" : "草稿"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => doDownload(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {managing && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteDoc(d.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(o) => { if (!o) setSelectedDoc(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {DOC_TYPES.find(t => t.id === selectedDoc.type)?.label || selectedDoc.type}
                  <Badge variant="outline" className="text-xs ml-2">{selectedDoc.orderNo}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="border rounded-lg p-4 bg-white" dangerouslySetInnerHTML={{
                __html: generateDocContent(selectedDoc).html
              }} />
              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => doDownload(selectedDoc)}>
                  <Download className="h-4 w-4 mr-1" />下载文件
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedDoc(null)}>关闭</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
// Needed for generate toast
import { toast } from "sonner";

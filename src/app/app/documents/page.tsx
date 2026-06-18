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
import { toast } from "sonner";

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

export default function DocumentsPage() {
  const [tab, setTab] = useState<"generate" | "list">("generate");
  const [selOrder, setSelOrder] = useState("o1");
  const [selType, setSelType] = useState(DOC_TYPES[0].id);
  const [generating, setGenerating] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [generatedDocs, setGeneratedDocs] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [managing, setManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => { loadGenerated(); loadOrders(); }, []);

  async function loadOrders() {
    try {
      const r = await fetch("/api/orders");
      const data = await r.json();
      if (Array.isArray(data)) setOrders(data);
    } catch {}
  }

  async function loadGenerated() {
    try {
      const r = await fetch("/api/documents/download");
      const data = await r.json();
      if (data?.documents) setGeneratedDocs(data.documents);
    } catch {}
  }

  function doDownload(doc: any) {
    const url = `/api/documents/download?id=${doc.id}`;
    window.open(url, "_blank");
    toast.success("预览已在新窗口打开");
  }

  function doRealDownload(doc: any) {
    const url = `/api/documents/download?id=${doc.id}`;
    window.open(url, "_blank");
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
        toast.success(`✅ ${data.count || 1} 份单证已生成`);
        setTab("list");
        if (data.documents) loadGenerated();
      } else {
        toast.error("生成失败");
      }
    } catch {
      toast.error("生成失败");
    }
    setGenerating(false);
  };

  async function handleDeleteDoc(id: string) {
    if (!confirm("确定要删除该单证吗？")) return;
    try {
      const r = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (r.ok) { toast.success("单证已删除"); loadGenerated(); }
      else toast.error("删除失败");
    } catch { toast.error("删除失败"); }
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) { toast.error("请选择要删除的单证"); return; }
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 份单证吗？`)) return;
    let ok = 0;
    for (const id of selectedIds) {
      try {
        const r = await fetch("/api/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        if (r.ok) ok++;
      } catch {}
    }
    toast.success(`${ok} 份单证已删除`);
    setSelectedIds([]);
    setManaging(false);
    loadGenerated();
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

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
              {orders.map(o => (
                <Card key={o.id}
                  className={cn("cursor-pointer transition-all hover:shadow-md", selOrder === o.id && "ring-2 ring-primary shadow-md")}
                  onClick={() => setSelOrder(o.id)}>
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm">{o.no}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.contactName}</p>
                    <p className="text-xs text-muted-foreground">${(o.totalAmount || 0).toLocaleString()}</p>
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
                        <Clock className="h-3 w-3" />{d.createdAt?.slice(0, 10) || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={isGen ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      <CheckCircle className="h-3 w-3 mr-1" />{isGen ? "已生成" : "草稿"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => doRealDownload(d)} title="预览/下载">
                      <Eye className="h-4 w-4" />
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
              <div className="border rounded-lg p-4 bg-white">
                <iframe src={`/api/documents/download?id=${selectedDoc.id}`} className="w-full h-[400px] border-0" />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => doRealDownload(selectedDoc)}>
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

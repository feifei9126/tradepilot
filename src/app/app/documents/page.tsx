"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileText,
  Download,
  Plus,
  CheckCircle,
  History,
  Eye,
  Loader2,
  Trash2,
  FileSpreadsheet,
  ScrollText,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { StoredDocument, StoredOrder } from "@/lib/store";
import { formatMoney } from "@/lib/currency";

const DOC_TYPES = [
  {
    id: "commercial_invoice",
    label: "商业发票",
    abbr: "CI",
    icon: FileText,
    desc: "Commercial Invoice",
    color: "blue",
  },
  {
    id: "packing_list",
    label: "装箱单",
    abbr: "PL",
    icon: FileSpreadsheet,
    desc: "Packing List",
    color: "green",
  },
  {
    id: "proforma_invoice",
    label: "形式发票",
    abbr: "PI",
    icon: ScrollText,
    desc: "Proforma Invoice",
    color: "purple",
  },
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
  const [selectedDoc, setSelectedDoc] = useState<StoredDocument | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<StoredDocument[]>([]);
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [managing, setManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadGenerated();
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const r = await fetch("/api/orders");
      const data = await r.json();
      if (!r.ok || !Array.isArray(data)) {
        throw new Error(data.error || "订单数据加载失败");
      }
      setOrders(data);
      setSelOrder((current) =>
        data.some((order: StoredOrder) => order.id === current)
          ? current
          : data[0]?.id || "",
      );
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "订单数据加载失败");
    }
  }

  async function loadGenerated() {
    try {
      const r = await fetch("/api/documents/download");
      const data = await r.json();
      if (!r.ok || !Array.isArray(data?.documents)) {
        throw new Error(data.error || "单证列表加载失败");
      }
      setGeneratedDocs(data.documents);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "单证列表加载失败");
    }
  }

  function doRealDownload(doc: StoredDocument) {
    const url = `/api/documents/download?id=${doc.id}&download=1`;
    window.open(url, "_blank");
  }

  function doPreview(doc: StoredDocument) {
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
      const data = await res.json();
      if (res.ok) {
        toast.success(
          data.createdCount > 0 ? "单证草稿已生成" : "该订单已有同类型单证草稿",
        );
        setTab("list");
        if (data.documents) loadGenerated();
      } else {
        toast.error(data.error || "生成失败");
      }
    } catch {
      toast.error("生成失败");
    }
    setGenerating(false);
  };

  function handleDeleteDoc(id: string) {
    setDeleteTargets([id]);
  }

  function handleBatchDelete() {
    if (selectedIds.length === 0) {
      toast.error("请选择要删除的单证");
      return;
    }
    setDeleteTargets([...selectedIds]);
  }

  async function confirmDelete() {
    setDeleting(true);
    let ok = 0;
    for (const id of deleteTargets) {
      try {
        const r = await fetch("/api/documents", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (r.ok) ok++;
      } catch {}
    }
    if (ok === deleteTargets.length) toast.success(`${ok} 份单证已删除`);
    else
      toast.error(`已删除 ${ok} 份，${deleteTargets.length - ok} 份删除失败`);
    setDeleteTargets([]);
    setDeleting(false);
    setSelectedIds([]);
    setManaging(false);
    await loadGenerated();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">单证管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            根据订单数据生成可核对的商业发票、装箱单和形式发票 HTML 草稿
          </p>
        </div>
      </div>

      {/* Tab Switch */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("generate")}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            tab === "generate"
              ? "bg-white shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <FileText className="h-4 w-4 inline mr-1.5" />
          生成单证
        </button>
        <button
          type="button"
          onClick={() => setTab("list")}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            tab === "list"
              ? "bg-white shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <History className="h-4 w-4 inline mr-1.5" />
          已生成
        </button>
      </div>

      {tab === "generate" ? (
        <div className="space-y-6">
          {/* Step 1: 选择订单 */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                1
              </span>
              选择订单
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={cn(
                    "rounded-md border bg-card p-4 text-left transition-all hover:shadow-md",
                    selOrder === o.id && "ring-2 ring-primary shadow-md",
                  )}
                  onClick={() => setSelOrder(o.id)}
                >
                  <p className="font-semibold text-sm">{o.no}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {o.contactName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(o.totalAmount, o.currency)}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: 选择单证类型 */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                2
              </span>
              选择单证类型
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {DOC_TYPES.map((t) => {
                const Icon = t.icon;
                const active = selType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      "rounded-md border bg-card p-4 text-center transition-all hover:shadow-md",
                      COLORS[t.color],
                      active && "ring-2 ring-primary shadow-md",
                    )}
                    onClick={() => setSelType(t.id)}
                  >
                    <Icon className="h-6 w-6 mx-auto" />
                    <div className="mt-2">
                      <p className="font-semibold text-sm">{t.abbr}</p>
                      <p className="text-[10px] opacity-80">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              size="sm"
              onClick={doGenerate}
              disabled={generating || !selOrder}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Plus className="h-4 w-4 mr-1.5" />
              )}
              {generating ? "生成中..." : "一键生成"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {generatedDocs.length} 份单证
            </p>
            <div className="flex gap-2">
              {managing ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleBatchDelete}
                    disabled={selectedIds.length === 0}
                  >
                    删除选中 ({selectedIds.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setManaging(false);
                      setSelectedIds([]);
                    }}
                  >
                    完成整理
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setManaging(true)}
                >
                  整理
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {generatedDocs.map((d) => {
              const dt = DOC_TYPES.find((t) => t.id === d.type);
              const Icon = dt?.icon || FileText;
              const isGen = d.status === "generated";
              return (
                <Card
                  key={d.id}
                  className={`hover:shadow-sm transition-shadow ${managing && selectedIds.includes(d.id) ? "ring-2 ring-primary" : ""}`}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {managing && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      )}
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          COLORS[dt?.color || "blue"],
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {dt?.label} — {d.orderNo}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {d.createdAt?.slice(0, 10) || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          isGen
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {isGen ? "已生成" : "草稿"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => doPreview(d)}
                        title="预览"
                        aria-label={`预览 ${d.orderNo} 单证`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {managing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteDoc(d.id)}
                          aria-label={`删除 ${d.orderNo} 单证`}
                          title="删除单证"
                        >
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
      <Dialog
        open={!!selectedDoc}
        onOpenChange={(o) => {
          if (!o) setSelectedDoc(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {DOC_TYPES.find((t) => t.id === selectedDoc.type)?.label ||
                    selectedDoc.type}
                  <Badge variant="outline" className="text-xs ml-2">
                    {selectedDoc.orderNo}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="border rounded-lg p-4 bg-white">
                <iframe
                  title={`${selectedDoc.orderNo} 单证预览`}
                  src={`/api/documents/download?id=${selectedDoc.id}`}
                  className="w-full h-[400px] border-0"
                />
              </div>
              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => doRealDownload(selectedDoc)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  下载 HTML 草稿
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDoc(null)}
                >
                  关闭
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTargets([]);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除单证</DialogTitle>
            <DialogDescription>
              将永久删除选中的 {deleteTargets.length} 份单证，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTargets([])}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

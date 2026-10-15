"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Check, FileText, Film, ImageIcon, Loader2, Package, RefreshCw, Server } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type FirecrawlImportedProduct = {
  id: string;
  name?: string;
  modelNo?: string;
  hsCode?: string;
  costPrice?: number;
  unit?: string;
  moq?: number;
  source?: string;
  media?: { type: "image" | "video"; url: string }[];
};

type ImportPreview = Omit<FirecrawlImportedProduct, "id" | "source"> & {
  note?: string;
  sourceUrl?: string;
  description?: string;
  category?: string;
};

type DiscoverySettings = {
  hasApiKey: boolean;
  enabled: boolean;
  dailyRequestLimit: number;
  platformDailyLimit: number;
  requestsToday: number;
};

export function FirecrawlImportDialog({ open, onOpenChange, onImported }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (product: FirecrawlImportedProduct) => void;
}) {
  const { data: session } = useSession();
  const canPreview = session?.user?.isPlatformAdmin === true;
  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportPreview | null>(null);
  const dailyLimit = settings ? Math.min(settings.dailyRequestLimit, settings.platformDailyLimit) : 0;
  const serviceReady = canPreview && settings?.enabled === true && settings.hasApiKey && settings.requestsToday < dailyLimit;

  // Opening this dialog reads only our own DB settings. It never probes or
  // deploys an instance service, nor incurs a provider request in the background.
  const refreshSettings = useCallback(async () => {
    if (!canPreview) return;
    setSettingsLoading(true);
    try {
      const response = await fetch("/api/tenant/discovery-settings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "工作区抓取配置读取失败");
      setSettings(data);
      setSettingsError("");
    } catch (error) {
      setSettings(null);
      setSettingsError(error instanceof Error ? error.message : "工作区抓取配置读取失败");
    } finally { setSettingsLoading(false); }
  }, [canPreview]);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => { void refreshSettings(); }, 0);
    return () => window.clearTimeout(timer);
  }, [open, refreshSettings]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setImportResult(null);
      setImportUrl("");
    }
    onOpenChange(nextOpen);
  }

  async function handleImport() {
    if (!canPreview || !serviceReady || importing) return;
    if (!importUrl.trim()) {
      toast.error("请输入产品链接");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const response = await fetch("/api/firecrawl/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      });
      const data = (await response.json()) as {
        preview?: ImportPreview;
        error?: string;
      };
      if (!response.ok || !data.preview) {
        throw new Error(data.error || "抓取失败");
      }
      setImportResult(data.preview);
      toast.success("抓取完成，请检查预览后确认");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "抓取失败");
    } finally {
      setImporting(false);
      await refreshSettings();
    }
  }

  async function confirmImport() {
    if (!importResult || !canPreview || importing) return;
    setImporting(true);
    try {
      const response = await fetch("/api/firecrawl/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: importResult }),
      });
      const data = (await response.json()) as {
        product?: FirecrawlImportedProduct;
        error?: string;
      };
      if (!response.ok || !data.product) {
        throw new Error(data.error || "确认导入失败");
      }
      onImported(data.product);
      toast.success("产品已添加到目录");
      handleOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "确认导入失败");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg"><Server className="size-5" />Firecrawl 产品与媒体采集</DialogTitle>
          <DialogDescription>使用当前工作区的 Firecrawl Cloud Key，抓取公开商品网页；检查预览并确认后才添加到产品目录。</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-5 py-4">
          <section className="space-y-3 rounded-md border bg-muted/40 p-4" aria-labelledby="firecrawl-settings-heading">
            <h3 id="firecrawl-settings-heading" className="text-sm font-semibold">先配置工作区 Key 与预算</h3>
            <ol className="list-inside list-decimal space-y-2 text-xs leading-5 text-muted-foreground">
              <li>由管理员在「AI 获客 → 第 0 步」保存本工作区的 Cloud Key、设置每日请求上限并启用。</li>
              <li>产品抓取与自动获客共用每日预算，按 UTC 自然日统计；失败也计次。供应商可能另行计费。</li>
              <li>填写无需登录的公开 HTTP/HTTPS 产品页。抓取仅允许平台管理员；普通成员可以手动录入产品。</li>
            </ol>
            <Link href="/app/prospecting#discovery-settings" className="text-sm text-primary underline">前往 AI 获客配置 Key 和预算 →</Link>
            {!canPreview ? <p className="text-sm text-amber-700 dark:text-amber-300">当前账号没有平台抓取权限，请联系平台管理员。</p> : <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs">{settingsLoading ? "正在读取配置……" : settingsError || (settings ? `今日已请求 ${settings.requestsToday}/${dailyLimit} 次 · ${settings.enabled && settings.hasApiKey ? "已配置并启用" : "未配置或已暂停"}` : "尚未读取配置")}</p>
                <Button size="sm" variant="outline" disabled={settingsLoading || importing} onClick={() => void refreshSettings()}><RefreshCw className={settingsLoading ? "animate-spin" : ""} />刷新配置和用量</Button>
              </div>
              <p className="text-xs text-muted-foreground">已配置不代表服务商连通性已验收。实例自托管服务和共享 Key 不作为抓取备用配置。</p>
            </>}
          </section>
          <section aria-labelledby="firecrawl-import-heading" className="space-y-3">
            <h3 id="firecrawl-import-heading" className="text-sm font-semibold">抓取产品页面</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="firecrawl-product-url" aria-label="产品页面链接" placeholder="https://example.com/products/..." maxLength={4096} value={importUrl} onChange={event => setImportUrl(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && serviceReady && !importing) void handleImport(); }} className="sm:flex-1" />
              <Button type="button" onClick={() => void handleImport()} disabled={importing || settingsLoading || !serviceReady}>{importing ? <Loader2 className="animate-spin" /> : <FileText />}{importing ? "正在抓取" : "开始抓取"}</Button>
            </div>
            {!serviceReady && canPreview && !settingsLoading && <p className="text-xs text-amber-700 dark:text-amber-300">请先启用工作区 Cloud Key 并确认今日预算尚有余额；请求超额不会联系供应商。</p>}
          </section>
          {importResult && (
            <section className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">抓取预览</h3>
                <Badge variant="outline">确认后才入库</Badge>
              </div>
              <div className="flex items-start gap-3 bg-muted/60 p-3">
                <Package className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{importResult.name || "产品"}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {importResult.modelNo && (
                      <span>型号: {importResult.modelNo}</span>
                    )}
                    {importResult.costPrice !== undefined && (
                      <span>
                        价格: ¥{importResult.costPrice}/
                        {importResult.unit || "件"}
                      </span>
                    )}
                    {importResult.hsCode && (
                      <span>HS: {importResult.hsCode}</span>
                    )}
                  </div>
                  {importResult.description && (
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                      {importResult.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <ImageIcon className="size-3.5" />
                      {importResult.media?.filter(
                        (item) => item.type === "image",
                      ).length || 0}{" "}
                      张图片
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Film className="size-3.5" />
                      {importResult.media?.filter(
                        (item) => item.type === "video",
                      ).length || 0}{" "}
                      个视频链接
                    </span>
                  </div>
                  {importResult.note && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      {importResult.note}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                onClick={confirmImport}
                disabled={importing}
                className="w-full"
              >
                {importing ? <Loader2 className="animate-spin" /> : <Check />}
                确认添加到产品目录
              </Button>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

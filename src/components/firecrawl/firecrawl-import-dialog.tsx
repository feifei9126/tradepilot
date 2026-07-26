"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clipboard,
  ExternalLink,
  FileText,
  Film,
  HardDrive,
  ImageIcon,
  Loader2,
  Package,
  RefreshCw,
  Rocket,
  Server,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  confirmationToken?: string;
};

type FirecrawlHealth = {
  configured: boolean;
  reachable: boolean;
  managed: boolean;
  hasApiKey: boolean;
  url?: string;
  version?: string;
  status: string;
};

type DeploymentPhase =
  | "idle"
  | "queued"
  | "checking"
  | "downloading"
  | "building"
  | "starting"
  | "verifying"
  | "ready"
  | "failed";

type DeploymentStatus = {
  phase: DeploymentPhase;
  progress: number;
  message: string;
  error?: string;
};

type DeploymentPrerequisite = {
  ok: boolean;
  label: string;
  detail: string;
};

type FirecrawlDeployment = {
  canDeploy: boolean;
  prerequisitesReady: boolean;
  prerequisites: Record<string, DeploymentPrerequisite>;
  status: DeploymentStatus;
  logTail: string[];
  version: string;
  repository: string;
  cliCommand: string;
};

const activeDeploymentPhases: DeploymentPhase[] = [
  "queued",
  "checking",
  "downloading",
  "building",
  "starting",
  "verifying",
];

function isDeploymentActive(phase: DeploymentPhase | undefined) {
  return Boolean(phase && activeDeploymentPhases.includes(phase));
}

function deploymentPhaseLabel(phase: DeploymentPhase | undefined) {
  const labels: Record<DeploymentPhase, string> = {
    idle: "未部署",
    queued: "排队中",
    checking: "检查环境",
    downloading: "下载源码",
    building: "构建镜像",
    starting: "启动服务",
    verifying: "真实抓取验证",
    ready: "部署完成",
    failed: "部署失败",
  };
  return phase ? labels[phase] : "检测中";
}

export function FirecrawlImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (product: FirecrawlImportedProduct) => void;
}) {
  const [health, setHealth] = useState<FirecrawlHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [deployment, setDeployment] = useState<FirecrawlDeployment | null>(
    null,
  );
  const [deploying, setDeploying] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportPreview | null>(null);

  const refreshHealth = useCallback(async (notify = false) => {
    setHealthLoading(true);
    try {
      const response = await fetch("/api/firecrawl/health", {
        cache: "no-store",
      });
      const data = (await response.json()) as FirecrawlHealth & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "连接检测失败");
      setHealth(data);
      if (notify) {
        if (data.reachable) toast.success("Firecrawl 连接正常");
        else toast.error(data.status || "Firecrawl 暂时无法连接");
      }
      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "连接检测失败";
      setHealth({
        configured: false,
        reachable: false,
        managed: false,
        hasApiKey: false,
        status: message,
      });
      if (notify) toast.error(message);
      return null;
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const refreshDeployment = useCallback(async (notify = false) => {
    try {
      const response = await fetch("/api/firecrawl/deploy", {
        cache: "no-store",
      });
      const data = (await response.json()) as FirecrawlDeployment & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "部署状态读取失败");
      setDeployment(data);
      return data;
    } catch (error: unknown) {
      if (notify) {
        toast.error(
          error instanceof Error ? error.message : "部署状态读取失败",
        );
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void refreshHealth();
      void refreshDeployment();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, refreshDeployment, refreshHealth]);

  useEffect(() => {
    if (!open || !isDeploymentActive(deployment?.status.phase)) return;
    const timer = window.setInterval(async () => {
      const next = await refreshDeployment();
      if (next?.status.phase === "ready") {
        await refreshHealth();
        toast.success("Firecrawl 已部署并通过真实抓取验证");
      }
    }, 2_500);
    return () => window.clearInterval(timer);
  }, [deployment?.status.phase, open, refreshDeployment, refreshHealth]);

  async function startDeployment() {
    setDeploying(true);
    try {
      const response = await fetch("/api/firecrawl/deploy", { method: "POST" });
      const data = (await response.json()) as FirecrawlDeployment & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "部署任务启动失败");
      }
      setDeployment(data);
      toast.success("部署已转入后台，可以继续使用 TradePilot");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "部署任务启动失败");
      await refreshDeployment();
    } finally {
      setDeploying(false);
    }
  }

  async function copyCommand() {
    const command = deployment?.cliCommand || "npm run firecrawl:deploy";
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(command);
      toast.success("部署命令已复制");
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = command;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand("copy");
      textArea.remove();
      if (copied) toast.success("部署命令已复制");
      else toast.error("复制失败，请手动选择命令");
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setImportResult(null);
      setImportUrl("");
    }
    onOpenChange(nextOpen);
  }

  async function handleImport() {
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
        confirmationToken?: string;
        error?: string;
      };
      if (!response.ok || !data.preview || !data.confirmationToken) {
        throw new Error(data.error || "抓取失败");
      }
      setImportResult({
        ...data.preview,
        confirmationToken: data.confirmationToken,
      });
      toast.success("抓取完成，请检查预览后确认");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "抓取失败");
    } finally {
      setImporting(false);
    }
  }

  async function confirmImport() {
    if (!importResult) return;
    setImporting(true);
    try {
      const response = await fetch("/api/firecrawl/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: importResult,
          confirmationToken: importResult.confirmationToken,
        }),
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

  const serviceReady = health?.reachable === true;
  const deploymentActive = isDeploymentActive(deployment?.status.phase);
  const prerequisites = deployment
    ? Object.values(deployment.prerequisites)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Server className="size-4" />
            </span>
            Firecrawl 产品与媒体采集
          </DialogTitle>
          <DialogDescription>
            把公开商品网页转换成可确认的产品资料、图片和视频素材。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 pb-5">
          <section className="grid gap-3 border-b py-5 sm:grid-cols-3">
            {[
              ["1", "粘贴商品页", "输入公开可访问的产品详情链接"],
              ["2", "自动提取", "识别标题、规格、价格、图片和视频"],
              ["3", "确认再入库", "预览无误后加入目录并用于视频生产"],
            ].map(([step, title, description]) => (
              <div key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <section
            aria-labelledby="firecrawl-service-heading"
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3
                  id="firecrawl-service-heading"
                  className="text-sm font-semibold"
                >
                  服务状态
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  抓取在独立服务中运行，不会阻塞 TradePilot 主站。
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refreshHealth(true)}
                disabled={healthLoading}
              >
                <RefreshCw className={healthLoading ? "animate-spin" : ""} />
                检测连接
              </Button>
            </div>

            <div
              className={
                serviceReady
                  ? "flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              }
            >
              <div className="flex min-w-0 gap-2">
                {serviceReady ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {serviceReady
                      ? "Firecrawl 可用"
                      : health?.status || "正在检测服务"}
                  </p>
                  <p className="mt-1 truncate text-xs opacity-80">
                    {health?.url || "尚未配置服务地址"}
                    {health?.managed ? " · TradePilot 本机托管" : ""}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 bg-background/70">
                {serviceReady ? "已连接" : "未连接"}
              </Badge>
            </div>
          </section>

          {!serviceReady && (
            <section
              aria-labelledby="firecrawl-deploy-heading"
              className="space-y-4 border-y bg-muted/30 px-5 py-5 -mx-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3
                    id="firecrawl-deploy-heading"
                    className="text-sm font-semibold"
                  >
                    一键部署到本机
                  </h3>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                    自动下载官方 {deployment?.version || "v2.11.0"}，构建并启动
                    API、Playwright、PostgreSQL、Redis 和
                    RabbitMQ，最后执行一次真实网页抓取。
                  </p>
                </div>
                <Badge variant="outline">
                  {deploymentPhaseLabel(deployment?.status.phase)}
                </Badge>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {prerequisites.length > 0 ? (
                  prerequisites.map((item) => (
                    <div
                      key={item.label}
                      className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-3 py-2"
                    >
                      {item.ok ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <CircleAlert className="size-4 shrink-0 text-amber-600" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="col-span-full text-xs text-muted-foreground">
                    正在检查 Git、Docker 和 Docker Compose...
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <HardDrive className="size-3.5" /> 建议预留 10 GB 磁盘和 8 GB
                  可用内存
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5" /> 首次构建通常需要 5-15
                  分钟以上
                </span>
              </div>

              {deploymentActive && deployment && (
                <div className="space-y-2" aria-live="polite">
                  <div className="flex items-center justify-between text-xs">
                    <span>{deployment.status.message}</span>
                    <span className="font-medium">
                      {deployment.status.progress}%
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label="Firecrawl 部署进度"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={deployment.status.progress}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${deployment.status.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {deployment?.status.phase === "failed" && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <p className="font-medium">{deployment.status.message}</p>
                  {deployment.status.error && (
                    <p className="mt-1 break-words">
                      {deployment.status.error}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="sm:flex-1"
                  onClick={startDeployment}
                  disabled={
                    deploying ||
                    deploymentActive ||
                    !deployment?.canDeploy ||
                    !deployment?.prerequisitesReady
                  }
                >
                  {deploying || deploymentActive ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Rocket />
                  )}
                  {deploymentActive ? "正在后台部署" : "一键部署 Firecrawl"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refreshDeployment(true)}
                >
                  <RefreshCw /> 重新检查环境
                </Button>
              </div>

              {deployment && !deployment.canDeploy && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  远程站点默认禁用网页部署，请由管理员在服务器执行下方命令。
                </p>
              )}

              <div className="flex items-center gap-2 rounded-md border bg-background p-2">
                <code className="min-w-0 flex-1 overflow-x-auto px-1 font-mono text-xs">
                  {deployment?.cliCommand || "npm run firecrawl:deploy"}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={copyCommand}
                  title="复制部署命令"
                  aria-label="复制部署命令"
                >
                  <Clipboard />
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <a
                  href={
                    deployment?.repository ||
                    "https://github.com/firecrawl/firecrawl"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Firecrawl 官方开源仓库 <ExternalLink className="size-3" />
                </a>
                {deployment && deployment.logTail.length > 0 && (
                  <details className="w-full rounded-md border bg-background p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium">
                      查看部署日志
                      <ChevronDown className="size-3.5" />
                    </summary>
                    <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-neutral-950 p-3 font-mono text-[11px] leading-5 text-neutral-100">
                      {deployment.logTail.join("\n")}
                    </pre>
                  </details>
                )}
              </div>
            </section>
          )}

          <section
            aria-labelledby="firecrawl-import-heading"
            className="space-y-3"
          >
            <div>
              <h3
                id="firecrawl-import-heading"
                className="text-sm font-semibold"
              >
                抓取产品页面
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                仅支持无需登录且可公开访问的 HTTP(S) 商品详情页。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="firecrawl-product-url"
                aria-label="产品页面链接"
                placeholder="https://example.com/products/..."
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && serviceReady)
                    void handleImport();
                }}
                className="sm:flex-1"
              />
              <Button
                type="button"
                onClick={handleImport}
                disabled={importing || !serviceReady}
              >
                {importing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileText />
                )}
                {importing ? "正在抓取" : "开始抓取"}
              </Button>
            </div>
            {!serviceReady && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                服务连接成功后才可抓取。请先启动 Docker Desktop 并完成部署。
              </p>
            )}
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

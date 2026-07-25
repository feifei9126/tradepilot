"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  Film,
  Globe2,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
  Trash2,
  Video,
  Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Product = {
  id: string;
  name: string;
  modelNo?: string;
  category?: string;
  description?: string;
  media?: { type: "image" | "video"; url: string }[];
};

type ProductVideoJob = {
  id: string;
  productId: string;
  productName: string;
  title: string;
  style: string;
  language: string;
  duration: number;
  aspectRatio: string;
  status:
    | "queued"
    | "researching"
    | "scripting"
    | "rendering"
    | "completed"
    | "failed";
  progress: number;
  engine?: VideoEngine;
  workerMode: VideoEngine | "mock";
  pipeline?:
    | "mock"
    | "local-renderer"
    | "moneyprinterturbo"
    | "openmontage-command"
    | "handoff";
  sourceImages?: string[];
  sourceVideos?: string[];
  brief: string;
  script?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type VideoEngine = "local" | "moneyprinterturbo" | "openmontage";

type EngineHealth = {
  id: VideoEngine;
  label: string;
  configured: boolean;
  ok: boolean;
  url?: string;
  error?: string;
  detail?: string;
};

type WorkerHealth = {
  engines: Record<VideoEngine, EngineHealth>;
};

const LOCAL_START_COMMAND = `bash install.sh`;

const STANDALONE_WORKER_COMMAND = `OPENMONTAGE_WORKSPACE=./openmontage-workspace npm run video-worker`;

const TRADEPILOT_WORKER_ENV = `OPENMONTAGE_WORKER_URL=http://localhost:8787`;

const OPENMONTAGE_COMMAND_ENV = `OPENMONTAGE_COMMAND=python3
OPENMONTAGE_COMMAND_ARGS_JSON=["scripts/tradepilot_job.py","--job-file","{jobFile}","--output-dir","{outputDir}"]
OPENMONTAGE_REPO=/path/to/OpenMontage
OPENMONTAGE_WORKSPACE=/path/to/video-workspace`;

const MONEYPRINTERTURBO_COMMAND = `docker compose up -d moneyprinterturbo`;

const VIDEO_ENGINES: {
  id: VideoEngine;
  label: string;
  description: string;
  recommendation: string;
  useCase: string;
  materials: string;
  output: string;
  icon: typeof Cpu;
}[] = [
  {
    id: "local",
    label: "本地快速",
    description: "最快得到一条可播放样片",
    recommendation: "首次尝试",
    useCase: "内部确认、快速看效果",
    materials: "产品资料；图片可选",
    output: "基础动效产品展示",
    icon: Cpu,
  },
  {
    id: "moneyprinterturbo",
    label: "AI 自动成片",
    description: "自动完成配音、字幕和音乐",
    recommendation: "日常发布",
    useCase: "社媒推广、客户介绍",
    materials: "最多 6 个图片或视频素材",
    output: "带配音字幕的完整短视频",
    icon: Bot,
  },
  {
    id: "openmontage",
    label: "高级制作",
    description: "接入自定义专业制作流水线",
    recommendation: "品牌项目",
    useCase: "重点产品、品牌宣传片",
    materials: "脚本、素材与已配置流程",
    output: "定制镜头与高级后期",
    icon: Clapperboard,
  },
];

const ENGINE_LABEL: Record<VideoEngine, string> = Object.fromEntries(
  VIDEO_ENGINES.map((item) => [item.id, item.label]),
) as Record<VideoEngine, string>;

function engineForJob(job: ProductVideoJob): VideoEngine {
  if (job.engine) return job.engine;
  if (
    job.workerMode === "moneyprinterturbo" ||
    job.workerMode === "openmontage" ||
    job.workerMode === "local"
  ) {
    return job.workerMode;
  }
  return "local";
}

const VIDEO_STYLES = [
  { id: "b2b-showcase", label: "B2B 产品展示" },
  { id: "factory-demo", label: "工厂能力展示" },
  { id: "tiktok-short", label: "TikTok/Reels 短视频" },
  { id: "trade-fair", label: "展会介绍" },
  { id: "inquiry-reply", label: "询盘回复视频" },
];

const LANGUAGES = [
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "de", label: "Deutsch" },
  { id: "fr", label: "Français" },
];

const STATUS_LABEL: Record<ProductVideoJob["status"], string> = {
  queued: "排队中",
  researching: "产品研究",
  scripting: "脚本生成",
  rendering: "渲染中",
  completed: "已完成",
  failed: "失败",
};

const PIPELINE_LABEL: Record<
  NonNullable<ProductVideoJob["pipeline"]>,
  string
> = {
  mock: "仅流程模拟",
  "local-renderer": "本地真实成片",
  moneyprinterturbo: "MoneyPrinterTurbo AI 成片",
  "openmontage-command": "OpenMontage 制作",
  handoff: "待外部制作",
};

function CommandBlock({ label, command }: { label: string; command: string }) {
  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      toast.success(`已复制：${label}`);
    } catch {
      toast.error("复制失败，请手动选择命令");
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-md border bg-muted/40">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={copyCommand}
          title={`复制${label}`}
          aria-label={`复制${label}`}
        >
          <Copy />
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 py-2.5 text-[11px] leading-5 text-foreground">
        <code>{command}</code>
      </pre>
    </div>
  );
}

export default function ProductVideoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [jobs, setJobs] = useState<ProductVideoJob[]>([]);
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [engine, setEngine] = useState<VideoEngine>("moneyprinterturbo");
  const [productId, setProductId] = useState("");
  const [style, setStyle] = useState("b2b-showcase");
  const [language, setLanguage] = useState("en");
  const [duration, setDuration] = useState("30");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [sourceImages, setSourceImages] = useState("");
  const [sourceVideos, setSourceVideos] = useState("");
  const [brief, setBrief] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [previewJob, setPreviewJob] = useState<ProductVideoJob | null>(null);
  const [checkingWorker, setCheckingWorker] = useState(false);
  const [deploymentOpen, setDeploymentOpen] = useState(false);
  const refreshingJobs = useRef(new Set<string>());

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId),
    [productId, products],
  );

  const filteredJobs = useMemo(
    () =>
      statusFilter === "all"
        ? jobs
        : jobs.filter((job) => job.status === statusFilter),
    [jobs, statusFilter],
  );

  const completedCount = jobs.filter(
    (job) => job.status === "completed",
  ).length;
  const activeCount = jobs.filter(
    (job) => !["completed", "failed"].includes(job.status),
  ).length;
  const allVisibleSelected =
    filteredJobs.length > 0 &&
    filteredJobs.every((job) => selectedIds.has(job.id));
  const selectedEngineHealth = health?.engines?.[engine];
  const selectedEngineOption =
    VIDEO_ENGINES.find((item) => item.id === engine) || VIDEO_ENGINES[0];
  const sourceImageCount = sourceImages
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean).length;
  const sourceVideoCount = sourceVideos
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean).length;
  const sourceMediaCount = sourceImageCount + sourceVideoCount;
  const materialsReady =
    sourceMediaCount <= 6 &&
    (engine !== "moneyprinterturbo" || sourceMediaCount > 0);
  const preparationChecks = [
    { label: "引擎可用", complete: Boolean(selectedEngineHealth?.ok) },
    { label: "已选产品", complete: Boolean(productId) },
    {
      label: engine === "moneyprinterturbo" ? "素材符合要求" : "素材数量正常",
      complete: materialsReady,
    },
  ];
  const readyCount = preparationChecks.filter((item) => item.complete).length;
  const canSubmit = Boolean(
    selectedEngineHealth?.ok && productId && materialsReady && !submitting,
  );
  const submitLabel = submitting
    ? "正在创建任务"
    : !selectedEngineHealth?.ok
      ? "先连接当前引擎"
      : !productId
        ? "先选择一个产品"
        : sourceMediaCount > 6
          ? "图片和视频素材最多 6 个"
          : !materialsReady
            ? "先添加图片或视频素材"
            : "创建视频任务";

  function selectProduct(value: string, productOptions = products) {
    setProductId(value);
    const media =
      productOptions.find((product) => product.id === value)?.media || [];
    const images = media
      .filter((item) => item.type === "image")
      .slice(0, 6)
      .map((item) => item.url);
    const videos = media
      .filter((item) => item.type === "video")
      .slice(0, 6 - images.length)
      .map((item) => item.url);
    setSourceImages(images.join("\n"));
    setSourceVideos(videos.join("\n"));
  }

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const [productsRes, jobsRes, healthRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/product-videos"),
        fetch("/api/product-videos/worker/health"),
      ]);
      const [productPayload, jobPayload, healthPayload] = await Promise.all([
        productsRes.json(),
        jobsRes.json(),
        healthRes.json(),
      ]);
      if (!productsRes.ok || !Array.isArray(productPayload))
        throw new Error("产品数据加载失败");
      if (!jobsRes.ok || !Array.isArray(jobPayload))
        throw new Error("视频任务加载失败");
      if (!healthRes.ok || !healthPayload || typeof healthPayload !== "object")
        throw new Error("视频引擎状态加载失败");
      const productData = productPayload as Product[];
      const jobData = (jobPayload as ProductVideoJob[]).map((job) => ({
        ...job,
        sourceImages: Array.isArray(job.sourceImages) ? job.sourceImages : [],
        sourceVideos: Array.isArray(job.sourceVideos) ? job.sourceVideos : [],
      }));
      if (cancelled) return;
      setProducts(productData);
      setJobs(jobData);
      const healthData = healthPayload as WorkerHealth;
      setHealth(healthData);
      setEngine((current) => {
        if (healthData.engines?.[current]?.ok) return current;
        if (healthData.engines?.moneyprinterturbo?.ok)
          return "moneyprinterturbo";
        if (healthData.engines?.local?.ok) return "local";
        return current;
      });
      const requestedProductId = new URLSearchParams(
        window.location.search,
      ).get("productId");
      if (
        requestedProductId &&
        productData.some((product) => product.id === requestedProductId)
      ) {
        setProductId(requestedProductId);
        const media =
          productData.find((product) => product.id === requestedProductId)
            ?.media || [];
        const images = media
          .filter((item) => item.type === "image")
          .slice(0, 6)
          .map((item) => item.url);
        const videos = media
          .filter((item) => item.type === "video")
          .slice(0, 6 - images.length)
          .map((item) => item.url);
        setSourceImages(images.join("\n"));
        setSourceVideos(videos.join("\n"));
      }
      setLoading(false);
    }
    void loadData().catch((error: unknown) => {
      if (!cancelled) {
        toast.error(
          error instanceof Error ? error.message : "产品视频数据加载失败",
        );
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const activeJobs = jobs.some(
      (job) => !["completed", "failed"].includes(job.status),
    );
    if (!activeJobs) return;

    const interval = window.setInterval(() => {
      void Promise.all(
        jobs
          .filter((job) => !["completed", "failed"].includes(job.status))
          .map((job) => refreshJob(job.id, false)),
      );
    }, 5000);

    return () => window.clearInterval(interval);
  }, [jobs]);

  async function handleSubmit() {
    if (!productId) {
      toast.error("请选择产品");
      return;
    }
    if (!selectedEngineHealth?.ok) {
      toast.error(
        `${VIDEO_ENGINES.find((item) => item.id === engine)?.label || "视频引擎"}尚未连接`,
      );
      return;
    }
    const normalizedImages = sourceImages
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean);
    const normalizedVideos = sourceVideos
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean);
    if (
      engine === "moneyprinterturbo" &&
      normalizedImages.length + normalizedVideos.length === 0
    ) {
      toast.error("MoneyPrinterTurbo 至少需要一个图片或视频素材");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/product-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          engine,
          style,
          language,
          duration: Number(duration),
          aspectRatio,
          sourceImages: normalizedImages,
          sourceVideos: normalizedVideos,
          brief,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建任务失败");
        return;
      }
      setJobs((prev) => [data, ...prev]);
      toast.success(
        `已提交到 ${VIDEO_ENGINES.find((item) => item.id === engine)?.label || "视频引擎"}`,
      );
      setBrief("");
      setSourceImages("");
      setSourceVideos("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "创建视频任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshJob(jobId: string, notify = true) {
    if (refreshingJobs.current.has(jobId)) return;
    refreshingJobs.current.add(jobId);
    try {
      const res = await fetch(`/api/product-videos/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "任务刷新失败");
      setJobs((prev) => prev.map((job) => (job.id === jobId ? data : job)));
    } catch (error: unknown) {
      if (notify)
        toast.error(error instanceof Error ? error.message : "任务刷新失败");
    } finally {
      refreshingJobs.current.delete(jobId);
    }
  }

  function toggleSelected(jobId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected)
        filteredJobs.forEach((job) => next.delete(job.id));
      else filteredJobs.forEach((job) => next.add(job.id));
      return next;
    });
  }

  async function confirmDelete() {
    if (deleteTargets.length === 0) return;
    setDeleting(true);
    try {
      const results = await Promise.all(
        deleteTargets.map(async (jobId) => {
          const response = await fetch(`/api/product-videos/${jobId}`, {
            method: "DELETE",
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "删除任务失败");
          return data;
        }),
      );
      const deleted = new Set(deleteTargets);
      setJobs((current) => current.filter((job) => !deleted.has(job.id)));
      setSelectedIds(
        (current) => new Set([...current].filter((id) => !deleted.has(id))),
      );
      const cleanupWarning = results.find((result) => result.warning)?.warning;
      if (cleanupWarning)
        toast.warning(`任务已删除，但 Worker 清理失败：${cleanupWarning}`);
      else toast.success(`已删除 ${deleteTargets.length} 个视频任务`);
      setDeleteTargets([]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "删除任务失败");
    } finally {
      setDeleting(false);
    }
  }

  async function checkWorkerConnection() {
    setCheckingWorker(true);
    try {
      const response = await fetch("/api/product-videos/worker/health", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "连接检测失败");
      setHealth(data);
      const current = data.engines?.[engine] as EngineHealth | undefined;
      if (current?.ok) toast.success(`${current.label}连接正常`);
      else
        toast.error(current?.error || `${current?.label || "视频引擎"}未响应`);
    } catch {
      toast.error("连接检测失败，请确认 TradePilot 服务正在运行");
    } finally {
      setCheckingWorker(false);
    }
  }

  function scrollToContentForm() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById("video-content-form")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );

  return (
    <div className="page-stack">
      <section
        className="studio-stage p-5 sm:p-6"
        aria-labelledby="video-studio-title"
      >
        <div className="relative z-[1] flex flex-col gap-5">
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#8bd2de]">
                <span className="studio-live-dot" />
                GROWTH STUDIO / LIVE PRODUCTION
              </div>
              <h1
                id="video-studio-title"
                className="text-2xl font-bold text-white"
              >
                产品内容与销售业务，在同一条增长链路里协同。
              </h1>
              <p className="studio-muted mt-2 max-w-3xl text-xs leading-5">
                Firecrawl 负责采集产品素材，MoneyPrinterTurbo 与 OpenMontage
                负责生产，所有任务、成片和引擎状态在这里统一管理。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                render={<Link href="/app/products?import=1" />}
                nativeButton={false}
                variant="outline"
                size="sm"
                className="border-[#46515b] bg-[#24292f] text-white shadow-none hover:border-[#66737e] hover:bg-[#2d343b] hover:text-white"
              >
                <Globe2 />
                Firecrawl 抓取素材
              </Button>
              <Button
                size="sm"
                className="bg-[#e85b32] shadow-[0_6px_18px_rgb(232_91_50/24%)] hover:bg-[#f16c45]"
                onClick={scrollToContentForm}
              >
                <Sparkles />
                创建视频
              </Button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,.7fr)_minmax(520px,1.3fr)]">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-[#343c44] bg-[#20252a] px-3 py-3">
                <span className="block text-[10px] text-[#8f9aa4]">
                  本月任务
                </span>
                <strong className="mt-1.5 block text-xl tabular-nums text-white">
                  {jobs.length}
                </strong>
              </div>
              <div className="rounded-md border border-[#343c44] bg-[#20252a] px-3 py-3">
                <span className="block text-[10px] text-[#8f9aa4]">生产中</span>
                <strong className="mt-1.5 block text-xl tabular-nums text-[#f18463]">
                  {activeCount}
                </strong>
              </div>
              <div className="rounded-md border border-[#343c44] bg-[#20252a] px-3 py-3">
                <span className="block text-[10px] text-[#8f9aa4]">已完成</span>
                <strong className="mt-1.5 block text-xl tabular-nums text-[#70c9ad]">
                  {completedCount}
                </strong>
              </div>
            </div>

            <div className="rounded-md border border-[#343c44] bg-[#20252a] p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-white">当前生产链路</p>
                <span className="studio-chip ml-auto">
                  <span className="status-dot" />
                  {selectedEngineHealth?.ok
                    ? `${selectedEngineHealth.label} 已连接`
                    : "引擎等待连接"}
                </span>
              </div>
              <div className="relative grid grid-cols-4 gap-2 before:absolute before:left-[12%] before:right-[12%] before:top-4 before:h-px before:bg-[#3b434b]">
                {[
                  {
                    label: "素材采集",
                    detail:
                      sourceMediaCount > 0
                        ? `${sourceMediaCount} 个素材`
                        : "等待素材",
                    icon: Globe2,
                    done: sourceMediaCount > 0,
                  },
                  {
                    label: "内容配置",
                    detail: productId ? "产品已选择" : "等待产品",
                    icon: FileText,
                    done: Boolean(productId),
                  },
                  {
                    label: "引擎准备",
                    detail: selectedEngineOption.label,
                    icon: Bot,
                    done: Boolean(selectedEngineHealth?.ok),
                  },
                  {
                    label: "合成出片",
                    detail:
                      activeCount > 0 ? `${activeCount} 个生产中` : "等待任务",
                    icon: Film,
                    done: completedCount > 0,
                  },
                ].map((step, index) => {
                  const Icon = step.icon;
                  const isCurrent =
                    !step.done &&
                    (index === 0 ||
                      [
                        sourceMediaCount > 0,
                        Boolean(productId),
                        Boolean(selectedEngineHealth?.ok),
                      ][index - 1]);
                  return (
                    <div
                      key={step.label}
                      className="relative z-[1] min-w-0 text-center"
                    >
                      <span
                        className={`mx-auto flex size-8 items-center justify-center rounded-full border-2 ${step.done ? "border-[#e85b32] bg-[#e85b32] text-white" : isCurrent ? "border-[#f18463] bg-[#20252a] text-[#f18463] shadow-[0_0_0_5px_rgb(232_91_50/10%)]" : "border-[#46505a] bg-[#20252a] text-[#7d8993]"}`}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <strong className="mt-2 block truncate text-[10px] text-white">
                        {step.label}
                      </strong>
                      <span className="mt-1 block truncate text-[9px] text-[#8f9aa4]">
                        {step.detail}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="engine-heading" className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#e85b32] text-xs font-semibold text-white">
                1
              </span>
              <h2 id="engine-heading" className="text-base font-semibold">
                选择生产方案
              </h2>
            </div>
            <p className="mt-1 pl-8 text-xs text-muted-foreground">
              第一次制作建议选“本地快速”；需要直接发布时选“AI 自动成片”。
            </p>
          </div>
          <span className="pl-8 text-xs text-muted-foreground sm:pl-0">
            点击方案即可切换
          </span>
        </div>

        <div
          className="grid gap-3 lg:grid-cols-3"
          role="group"
          aria-label="选择视频生产引擎"
        >
          {VIDEO_ENGINES.map((item) => {
            const Icon = item.icon;
            const engineHealth = health?.engines?.[item.id];
            const selected = engine === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setEngine(item.id)}
                aria-pressed={selected}
                className={`group relative min-w-0 rounded-md border p-4 text-left outline-none transition-[transform,border-color,background-color,box-shadow] duration-200 active:scale-[0.99] ${selected ? "border-[#e85b32] bg-[#fcebe6]/55 shadow-[0_8px_22px_rgb(232_91_50/10%)] ring-1 ring-[#e85b32]/20" : "bg-background hover:-translate-y-0.5 hover:border-[#e85b32]/35 hover:shadow-sm"}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${selected ? "bg-[#e85b32] text-white" : "bg-muted text-foreground"}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold">{item.label}</span>
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px]"
                        >
                          {item.recommendation}
                        </Badge>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${engineHealth?.ok ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${engineHealth?.ok ? "bg-emerald-500" : "bg-amber-500"}`}
                    />
                    {engineHealth?.ok ? "可用" : "未连接"}
                  </span>
                </span>
                <span className="mt-4 grid gap-2 border-t pt-3 text-xs">
                  <span className="grid grid-cols-[52px_1fr] gap-2">
                    <span className="text-muted-foreground">适合</span>
                    <span className="font-medium text-foreground">
                      {item.useCase}
                    </span>
                  </span>
                  <span className="grid grid-cols-[52px_1fr] gap-2">
                    <span className="text-muted-foreground">准备</span>
                    <span>{item.materials}</span>
                  </span>
                  <span className="grid grid-cols-[52px_1fr] gap-2">
                    <span className="text-muted-foreground">产出</span>
                    <span>{item.output}</span>
                  </span>
                </span>
                {selected && (
                  <CheckCircle2 className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-background text-[#e85b32]" />
                )}
              </button>
            );
          })}
        </div>

        <div
          key={engine}
          className={`animate-enter flex flex-col gap-3 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${selectedEngineHealth?.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/10"}`}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            {selectedEngineHealth?.ok ? (
              <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold">
                已选择 {selectedEngineOption.label} ·{" "}
                {selectedEngineOption.output}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedEngineHealth?.ok
                  ? `连接正常，下一步选择产品${engine === "moneyprinterturbo" ? "并添加产品图" : ""}。`
                  : "当前方案尚不可用，可先切换到已连接方案，或查看部署方式。"}
              </p>
            </div>
          </div>
          {!selectedEngineHealth?.ok && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setDeploymentOpen(true)}
            >
              <Terminal />
              查看部署方式
            </Button>
          )}
        </div>
      </section>

      <details
        id="engine-deployment"
        className="group border-b border-border/80 pb-4"
        open={deploymentOpen}
        onToggle={(event) => setDeploymentOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Terminal className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium">部署与连接</span>
            <span className="hidden truncate text-xs text-muted-foreground md:inline">
              引擎不可用时再展开
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-4 flex flex-col gap-3 rounded-md border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${selectedEngineHealth?.ok ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {selectedEngineHealth?.ok
                  ? `${selectedEngineHealth.label}已连接`
                  : selectedEngineHealth?.configured
                    ? `${selectedEngineHealth.label}已配置但未响应`
                    : "尚未配置当前引擎"}
              </p>
              <p className="mt-0.5 break-all text-xs text-muted-foreground">
                {selectedEngineHealth?.url || "通过 Docker 私有网络连接"}
                {selectedEngineHealth?.detail
                  ? ` · ${selectedEngineHealth.detail}`
                  : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkWorkerConnection}
            disabled={checkingWorker}
          >
            {checkingWorker ? <Loader2 className="animate-spin" /> : <Wifi />}
            检测连接
          </Button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="rounded-md border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">方式一：一键本地部署</h3>
              <Badge>推荐</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              在项目根目录执行一次。脚本先启动可独立工作的 TradePilot
              和本地视频引擎，再在后台下载
              MoneyPrinterTurbo。网页无需等待即可访问配置的 Web 端口。
            </p>
            <CommandBlock
              label="项目根目录执行"
              command={LOCAL_START_COMMAND}
            />
          </section>

          <section className="rounded-md border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">
                方式二：MoneyPrinterTurbo
              </h3>
              <Button
                render={
                  <a
                    href="https://github.com/harry0703/MoneyPrinterTurbo"
                    target="_blank"
                    rel="noreferrer"
                  />
                }
                nativeButton={false}
                variant="ghost"
                size="icon-sm"
                title="打开 MoneyPrinterTurbo 仓库"
                aria-label="打开 MoneyPrinterTurbo 仓库"
              >
                <ExternalLink />
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              单独启动 AI 视频服务与 Redis。默认使用本地产品素材、Edge TTS
              和字幕，无需额外的大模型 Key。
            </p>
            <CommandBlock
              label="项目根目录执行"
              command={MONEYPRINTERTURBO_COMMAND}
            />
          </section>

          <section className="rounded-md border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">
                方式三：独立/高级 Worker
              </h3>
              <Button
                render={
                  <a
                    href="https://github.com/calesthio/OpenMontage"
                    target="_blank"
                    rel="noreferrer"
                  />
                }
                nativeButton={false}
                variant="ghost"
                size="icon-sm"
                title="打开 OpenMontage 仓库"
                aria-label="打开 OpenMontage 仓库"
              >
                <ExternalLink />
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              本地 Worker 可独立运行；配置 OpenMontage
              命令后，同一服务会增加高级制作能力。
            </p>
            <CommandBlock
              label="独立 Worker"
              command={STANDALONE_WORKER_COMMAND}
            />
            <CommandBlock
              label="TradePilot 环境变量"
              command={TRADEPILOT_WORKER_ENV}
            />
            <CommandBlock
              label="部署环境变量示例"
              command={OPENMONTAGE_COMMAND_ENV}
            />
          </section>
        </div>

        <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-foreground">
          验收标准：访问{" "}
          <code className="rounded bg-background px-1 py-0.5">/health</code>{" "}
          返回 200，页面显示“Worker 已连接”。完整 OpenMontage 脚本必须把{" "}
          <code className="rounded bg-background px-1 py-0.5">final.mp4</code>{" "}
          和{" "}
          <code className="rounded bg-background px-1 py-0.5">result.json</code>{" "}
          写入任务输出目录。
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          MoneyPrinterTurbo 与本地 Worker 只应运行在私有网络。跨服务器部署请使用
          HTTPS、访问控制和 IP 白名单，不要直接暴露 8080 或 8787 端口。
        </div>
      </details>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card id="video-content-form" className="scroll-mt-20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#e85b32] text-xs font-semibold text-white">
                  2
                </span>
                填写视频内容
              </CardTitle>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                准备度 {readyCount}/3
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {preparationChecks.map((item) => (
                <div
                  key={item.label}
                  className={`flex min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 py-1.5 text-[10px] font-medium ${item.complete ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-700" : "bg-muted/40 text-muted-foreground"}`}
                >
                  <CheckCircle2
                    className={`h-3 w-3 shrink-0 ${item.complete ? "opacity-100" : "opacity-30"}`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">
                产品 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={productId}
                items={products.map((product) => ({
                  value: product.id,
                  label: product.name,
                }))}
                onValueChange={(value) => value && selectProduct(value)}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="选择一个产品" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct && (
                <div className="mt-2 border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {selectedProduct.name}
                  </p>
                  <p className="mt-1 line-clamp-3">
                    {selectedProduct.description ||
                      selectedProduct.category ||
                      "暂无描述"}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">视频类型</Label>
                <Select
                  value={style}
                  items={VIDEO_STYLES.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                  onValueChange={(value) => value && setStyle(value)}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_STYLES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">语言</Label>
                <Select
                  value={language}
                  items={LANGUAGES.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                  onValueChange={(value) => value && setLanguage(value)}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">时长</Label>
                <Select
                  value={duration}
                  items={{ "15": "15 秒", "30": "30 秒", "60": "60 秒" }}
                  onValueChange={(value) => value && setDuration(value)}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 秒</SelectItem>
                    <SelectItem value="30">30 秒</SelectItem>
                    <SelectItem value="60">60 秒</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">画幅</Label>
                <Select
                  value={aspectRatio}
                  items={{
                    "9:16": "9:16 竖屏",
                    "16:9": "16:9 横屏",
                    "1:1": "1:1 方形",
                  }}
                  onValueChange={(value) => value && setAspectRatio(value)}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16 竖屏</SelectItem>
                    <SelectItem value="16:9">16:9 横屏</SelectItem>
                    <SelectItem value="1:1">1:1 方形</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs">
                  图片素材 URL{" "}
                  {engine === "moneyprinterturbo" && (
                    <span className="text-destructive">*</span>
                  )}
                </Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {sourceMediaCount}/6 个
                </span>
              </div>
              <Textarea
                value={sourceImages}
                onChange={(e) => setSourceImages(e.target.value)}
                placeholder="每行一个公开的 JPEG/PNG 图片地址"
                className="mt-1 min-h-20 resize-y text-xs"
              />
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                产品导入后会自动带入图片素材，也可以手动替换。
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs">视频素材 URL</Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {sourceVideoCount} 个
                </span>
              </div>
              <Textarea
                value={sourceVideos}
                onChange={(e) => setSourceVideos(e.target.value)}
                placeholder="可选：每行一个公开的 MP4、MOV、WEBM 或 MKV 地址"
                className="mt-1 min-h-16 resize-y text-xs"
              />
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                Firecrawl 抓到的视频会自动带入；MoneyPrinterTurbo
                会将图片和视频一起重新编排。
              </p>
            </div>

            <div>
              <Label className="text-xs">
                视频简报{" "}
                <span className="font-normal text-muted-foreground">
                  （建议填写）
                </span>
              </Label>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="例如：突出续航、防水、欧美客户采购场景，结尾引导询盘。"
                className="mt-1 min-h-20 resize-y text-xs"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-10 w-full transition-[transform,box-shadow] active:scale-[0.99]"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {submitLabel}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              提交后可离开页面，任务会继续生成并保留在右侧列表。
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#20252a] text-xs font-semibold text-white">
                  3
                </span>
                <h2 className="text-sm font-semibold">生成与交付</h2>
              </div>
              <p className="mt-1 pl-8 text-xs text-muted-foreground">
                共 {jobs.length} 个 · 生产中 {activeCount} 个 · 已完成{" "}
                {completedCount} 个
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                items={{ all: "全部状态", ...STATUS_LABEL }}
                onValueChange={(value) => value && setStatusFilter(value)}
              >
                <SelectTrigger
                  className="h-8 w-[132px] text-xs"
                  aria-label="按状态筛选"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteTargets([...selectedIds])}
                >
                  <Trash2 />
                  删除 {selectedIds.size} 项
                </Button>
              )}
            </div>
          </div>

          {filteredJobs.length > 0 && (
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                className="h-4 w-4 accent-primary"
              />
              选择当前筛选结果（{filteredJobs.length}）
            </label>
          )}

          {jobs.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                <Video className="mx-auto mb-3 h-10 w-10 opacity-30" />
                暂无产品视频任务
              </CardContent>
            </Card>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              当前筛选条件下没有任务
            </div>
          ) : (
            filteredJobs.map((job, index) => (
              <Card
                key={job.id}
                className={`animate-enter surface-panel-hover ${index < 6 ? `animate-enter-${index + 1}` : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(job.id)}
                      onChange={() => toggleSelected(job.id)}
                      aria-label={`选择 ${job.title}`}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <div className="relative flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#20252a] text-white lg:w-28">
                      {job.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={job.thumbnailUrl}
                          alt={`${job.title} 缩略图`}
                          className="size-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                        />
                      ) : (
                        <Film className="size-6 text-[#9ca6af]" />
                      )}
                      {job.videoUrl && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="flex size-8 items-center justify-center rounded-full bg-white/90 text-[#20252a] shadow-sm">
                            <Play className="size-3.5 fill-current" />
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{job.title}</p>
                        <Badge
                          variant={
                            job.status === "failed"
                              ? "destructive"
                              : job.status === "completed"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {STATUS_LABEL[job.status]}
                        </Badge>
                        <Badge variant="outline">
                          {
                            PIPELINE_LABEL[
                              job.pipeline ||
                                (job.workerMode === "mock" ? "mock" : "handoff")
                            ]
                          }
                        </Badge>
                        <Badge variant="outline">
                          {ENGINE_LABEL[engineForJob(job)]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.productName} · {job.duration}s · {job.aspectRatio}{" "}
                        · {job.language}
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full origin-left rounded-full transition-transform duration-300 ${job.status === "completed" ? "bg-emerald-600" : job.status === "failed" ? "bg-destructive" : "bg-[#e85b32]"}`}
                          style={{
                            transform: `scaleX(${Math.min(job.progress, 100) / 100})`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.progress}%
                      </p>
                      {job.script && (
                        <pre className="mt-3 max-h-28 overflow-auto rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                          {job.script}
                        </pre>
                      )}
                      {job.error && (
                        <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {job.error}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => refreshJob(job.id)}
                      >
                        <RefreshCw className="mr-1 h-3.5 w-3.5" />
                        刷新
                      </Button>
                      {job.videoUrl ? (
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setPreviewJob(job)}
                        >
                          <Play className="mr-1 h-3.5 w-3.5" />
                          预览
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          disabled
                        >
                          <Clapperboard className="mr-1 h-3.5 w-3.5" />
                          等待成片
                        </Button>
                      )}
                      {job.videoUrl && (
                        <Button
                          render={<a href={job.videoUrl} download />}
                          nativeButton={false}
                          variant="outline"
                          size="icon-sm"
                          title="下载成片"
                          aria-label={`下载 ${job.title}`}
                        >
                          <Download />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="删除任务"
                        aria-label={`删除 ${job.title}`}
                        onClick={() => setDeleteTargets([job.id])}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {(job.sourceImages?.length || 0) +
                    (job.sourceVideos?.length || 0) >
                    0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {job.sourceImages?.length || 0} 张图片 ·{" "}
                      {job.sourceVideos?.length || 0} 个视频
                    </div>
                  )}
                  {job.status === "completed" && (
                    <CheckCircle2 className="mt-3 h-4 w-4 text-green-600" />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => !open && !deleting && setDeleteTargets([])}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除视频任务？</DialogTitle>
            <DialogDescription>
              将删除 {deleteTargets.length} 个任务，并尝试同步清理 Worker
              中的成片、缩略图和任务文件。此操作无法撤销。
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
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewJob)}
        onOpenChange={(open) => !open && setPreviewJob(null)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewJob?.title}</DialogTitle>
            <DialogDescription>
              成片通过 TradePilot 安全代理读取，内部 Worker
              地址不会暴露给浏览器。
            </DialogDescription>
          </DialogHeader>
          {previewJob?.videoUrl && (
            <video
              key={previewJob.videoUrl}
              src={previewJob.videoUrl}
              poster={previewJob.thumbnailUrl}
              controls
              playsInline
              className="max-h-[65vh] w-full rounded-md bg-black"
            >
              您的浏览器不支持视频播放。
            </video>
          )}
          <DialogFooter>
            {previewJob?.videoUrl && (
              <Button
                render={<a href={previewJob.videoUrl} download />}
                nativeButton={false}
              >
                <Download />
                下载成片
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

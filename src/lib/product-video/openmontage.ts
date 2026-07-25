import type { ProductVideoEngine, StoredProduct } from "../store";
import type {
  ProductVideoCreateInput,
  VideoEngineHealth,
  WorkerCreateResult,
  WorkerJobUpdate,
} from "./types";

type OpenMontageCreatePayload = {
  engine: "local" | "openmontage";
  title: string;
  product: {
    id: string;
    name: string;
    modelNo?: string;
    category?: string;
    description?: string;
    hsCode?: string;
    moq?: number;
    unit: string;
  };
  video: Omit<ProductVideoCreateInput, "productId" | "engine">;
};

type AdapterJob = {
  id?: string;
  jobId?: string;
  status?: WorkerJobUpdate["status"];
  progress?: number;
  script?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  pipeline?: WorkerJobUpdate["pipeline"];
  error?: string;
};

function getWorkerUrl() {
  return process.env.OPENMONTAGE_WORKER_URL?.replace(/\/$/, "") || "";
}

function buildPayload(
  product: StoredProduct,
  input: ProductVideoCreateInput,
): OpenMontageCreatePayload {
  const engine = input.engine === "openmontage" ? "openmontage" : "local";
  return {
    engine,
    title: `${product.name} ${input.duration}s ${input.language} product video`,
    product: {
      id: product.id,
      name: product.name,
      modelNo: product.modelNo,
      category: product.category,
      description: product.description,
      hsCode: product.hsCode,
      moq: product.moq,
      unit: product.unit,
    },
    video: {
      style: input.style,
      language: input.language,
      duration: input.duration,
      aspectRatio: input.aspectRatio,
      sourceImages: input.sourceImages,
      sourceVideos: input.sourceVideos || [],
      brief: input.brief,
    },
  };
}

async function adapterJson(response: Response): Promise<AdapterJob> {
  const data = await response.json().catch(() => ({})) as AdapterJob & { error?: string };
  if (!response.ok) throw new Error(data.error || `产品视频 Worker HTTP ${response.status}`);
  return data;
}

export async function createOpenMontageJob(
  product: StoredProduct,
  input: ProductVideoCreateInput,
): Promise<WorkerCreateResult> {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) throw new Error("本地/OpenMontage 视频 Worker 尚未配置");

  const response = await fetch(`${workerUrl}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload(product, input)),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await adapterJson(response);
  const workerJobId = data.id || data.jobId;
  if (!workerJobId) throw new Error("产品视频 Worker 未返回任务 ID");

  return {
    engine: input.engine,
    workerJobId,
    status: data.status || "queued",
    progress: typeof data.progress === "number" ? data.progress : 5,
    script: data.script,
    workerVideoPath: sanitizeAdapterAssetPath(data.videoUrl),
    workerThumbnailPath: sanitizeAdapterAssetPath(data.thumbnailUrl),
    pipeline: data.pipeline || (input.engine === "openmontage" ? "openmontage-command" : "local-renderer"),
  };
}

function sanitizeAdapterAssetPath(value?: string) {
  if (!value) return undefined;
  try {
    const url = value.startsWith("/") ? new URL(value, "http://worker.internal") : new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.pathname.startsWith("/assets/")) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

export async function refreshOpenMontageJob(workerJobId: string): Promise<WorkerJobUpdate> {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) throw new Error("本地/OpenMontage 视频 Worker 尚未配置");

  const response = await fetch(`${workerUrl}/jobs/${encodeURIComponent(workerJobId)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  const data = await adapterJson(response);
  return {
    status: data.status,
    progress: typeof data.progress === "number" ? data.progress : undefined,
    script: data.script,
    workerVideoPath: sanitizeAdapterAssetPath(data.videoUrl),
    workerThumbnailPath: sanitizeAdapterAssetPath(data.thumbnailUrl),
    error: data.error,
    pipeline: data.pipeline,
  };
}

export async function deleteOpenMontageJob(workerJobId: string) {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) return;
  const response = await fetch(`${workerUrl}/jobs/${encodeURIComponent(workerJobId)}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) await adapterJson(response);
}

type AdapterHealth = {
  ok?: boolean;
  mode?: "local-renderer" | "openmontage-command";
  commandConfigured?: boolean;
  workspace?: string;
};

export async function getOpenMontageHealth(): Promise<Record<"local" | "openmontage", VideoEngineHealth>> {
  const workerUrl = getWorkerUrl();
  const unavailable = (id: "local" | "openmontage", label: string): VideoEngineHealth => ({
    id,
    label,
    configured: false,
    ok: false,
  });
  if (!workerUrl) {
    return {
      local: unavailable("local", "本地 FFmpeg"),
      openmontage: unavailable("openmontage", "OpenMontage"),
    };
  }

  try {
    const response = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(5_000) });
    const data = await response.json().catch(() => ({})) as AdapterHealth;
    const workerOk = response.ok && Boolean(data.ok ?? true);
    return {
      local: {
        id: "local",
        label: "本地 FFmpeg",
        configured: true,
        ok: workerOk,
        url: workerUrl,
        detail: "快速生成基础产品展示视频",
        error: workerOk ? undefined : `HTTP ${response.status}`,
      },
      openmontage: {
        id: "openmontage",
        label: "OpenMontage",
        configured: Boolean(data.commandConfigured),
        ok: workerOk && Boolean(data.commandConfigured),
        url: workerUrl,
        detail: data.commandConfigured ? "高级 Agent 制作流水线" : "尚未配置 OpenMontage 命令",
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "视频 Worker 无法访问";
    return {
      local: { id: "local", label: "本地 FFmpeg", configured: true, ok: false, url: workerUrl, error: message },
      openmontage: { id: "openmontage", label: "OpenMontage", configured: true, ok: false, url: workerUrl, error: message },
    };
  }
}

export function openMontageAssetUrl(path: string) {
  const workerUrl = getWorkerUrl();
  const safePath = sanitizeAdapterAssetPath(path);
  if (!workerUrl || !safePath) throw new Error("产品视频 Worker 成片地址无效");
  return new URL(safePath, `${workerUrl}/`).toString();
}

export function normalizeLegacyEngine(value?: string): ProductVideoEngine {
  if (value === "moneyprinterturbo" || value === "openmontage" || value === "local") return value;
  return "local";
}

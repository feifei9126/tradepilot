import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { ProductVideoStatus, StoredProduct } from "../store";
import type {
  ProductVideoCreateInput,
  VideoEngineHealth,
  WorkerCreateResult,
  WorkerJobUpdate,
} from "./types";

const MAX_SOURCE_MEDIA = 6;
const MAX_IMAGE_BYTES = 15_000_000;
const MAX_VIDEO_BYTES = 100_000_000;
const MAX_REDIRECTS = 3;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);
const ALLOWED_VIDEO_TYPES = new Map([
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
  ["video/x-matroska", "mkv"],
]);

type MoneyPrinterTurboTask = {
  state?: number;
  progress?: number;
  videos?: string[];
  failed_stage?: string;
  error?: string;
};

type MoneyPrinterTurboResponse<T> = {
  status?: number;
  message?: string;
  data?: T;
};

function getBaseUrl() {
  return process.env.MONEYPRINTERTURBO_URL?.replace(/\/$/, "") || "";
}

function requestHeaders(contentType?: string) {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (process.env.MONEYPRINTERTURBO_API_KEY) {
    headers["x-api-key"] = process.env.MONEYPRINTERTURBO_API_KEY;
  }
  return headers;
}

function parseIpv4(address: string) {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

export function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const version = isIP(mappedIpv4 || normalized);

  if (version === 4) {
    const parts = parseIpv4(mappedIpv4 || normalized);
    if (!parts) return true;
    const [first, second, third] = parts;
    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 0)
      || (first === 192 && second === 168)
      || (first === 192 && second === 0 && third === 2)
      || (first === 198 && second >= 18 && second <= 19)
      || (first === 198 && second === 51 && third === 100)
      || (first === 203 && second === 0 && third === 113)
      || first >= 224;
  }

  if (version === 6) {
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith("ff")
      || normalized.startsWith("2001:db8:");
  }

  return true;
}

async function assertPublicUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("素材 URL 格式无效");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("素材只支持不含凭据的 HTTP 或 HTTPS URL");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("素材 URL 不能指向本机或局域网");
  }

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("素材 URL 解析到了不允许访问的网络地址");
  }
  return url;
}

async function readLimitedBody(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new Error(`单个素材不能超过 ${Math.round(maxBytes / 1_000_000)} MB`);
  if (!response.body) throw new Error("素材响应没有内容");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`单个素材不能超过 ${Math.round(maxBytes / 1_000_000)} MB`);
    }
    chunks.push(value);
  }
  if (total === 0) throw new Error("素材文件为空");
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Blob([combined.buffer]);
}

async function downloadPublicMedia(value: string, expectedType: "image" | "video") {
  let url = await assertPublicUrl(value);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "TradePilot-Video-Worker/1.0" },
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new Error("素材 URL 重定向次数过多");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`素材下载失败：HTTP ${response.status}`);

    const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
    const extension = expectedType === "image"
      ? ALLOWED_IMAGE_TYPES.get(contentType)
      : ALLOWED_VIDEO_TYPES.get(contentType);
    if (!extension) {
      throw new Error(expectedType === "image"
        ? "MoneyPrinterTurbo 图片素材仅支持 JPEG 或 PNG"
        : "MoneyPrinterTurbo 视频素材仅支持 MP4、MOV、WEBM 或 MKV");
    }
    return {
      blob: await readLimitedBody(response, expectedType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES),
      extension,
    };
  }

  throw new Error("素材下载失败");
}

function localizedScript(product: StoredProduct, input: ProductVideoCreateInput) {
  const benefit = input.brief || product.description || product.category || product.name;
  const scripts: Record<string, string> = {
    zh: `认识${product.name}。${benefit}。面向全球采购商，支持专业沟通与稳定交付。立即联系我们获取报价和样品。`,
    en: `Meet ${product.name}. ${benefit}. Built for global buyers who value dependable supply and clear communication. Contact us for pricing and samples.`,
    es: `Conozca ${product.name}. ${benefit}. Una opcion confiable para compradores internacionales. Contactenos para precios y muestras.`,
    de: `Entdecken Sie ${product.name}. ${benefit}. Eine verlaessliche Loesung fuer internationale Einkaeufer. Kontaktieren Sie uns fuer Preise und Muster.`,
    fr: `Decouvrez ${product.name}. ${benefit}. Une solution fiable pour les acheteurs internationaux. Contactez-nous pour les tarifs et les echantillons.`,
  };
  return scripts[input.language] || scripts.en;
}

function voiceForLanguage(language: string) {
  return {
    zh: "zh-CN-XiaoxiaoNeural-Female",
    en: "en-US-JennyNeural-Female",
    es: "es-ES-ElviraNeural-Female",
    de: "de-DE-KatjaNeural-Female",
    fr: "fr-FR-DeniseNeural-Female",
  }[language] || "en-US-JennyNeural-Female";
}

export function buildMoneyPrinterTurboVideoRequest(
  product: StoredProduct,
  input: ProductVideoCreateInput,
  materialFiles: string[],
) {
  return {
    video_subject: `${product.name} product video`,
    video_script: localizedScript(product, input),
    video_language: input.language,
    video_source: "local",
    video_materials: materialFiles.map((url) => ({ provider: "local", url, duration: 0 })),
    video_aspect: input.aspectRatio,
    video_concat_mode: "sequential",
    video_transition_mode: "FadeIn",
    video_clip_duration: Math.min(Math.max(input.duration, 3), 5),
    video_count: 1,
    voice_name: voiceForLanguage(input.language),
    voice_volume: 1,
    voice_rate: 1,
    bgm_type: "random",
    bgm_volume: 0.15,
    subtitle_enabled: true,
    subtitle_position: "bottom",
  };
}

export function sanitizeWorkerAssetPath(value?: string) {
  if (!value) return undefined;
  try {
    const url = value.startsWith("/") ? new URL(value, "http://worker.internal") : new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.pathname.startsWith("/tasks/")) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

export function mapMoneyPrinterTurboTask(task: MoneyPrinterTurboTask): WorkerJobUpdate {
  let status: ProductVideoStatus = "rendering";
  if (task.state === 1) status = "completed";
  if (task.state === -1) status = "failed";

  return {
    status,
    progress: Math.min(Math.max(Number(task.progress) || 0, 0), 100),
    error: task.error,
    workerVideoPath: sanitizeWorkerAssetPath(task.videos?.[0]),
  };
}

async function readJson<T>(response: Response): Promise<MoneyPrinterTurboResponse<T>> {
  const data = await response.json().catch(() => ({})) as MoneyPrinterTurboResponse<T>;
  if (!response.ok || (data.status && data.status >= 400)) {
    throw new Error(data.message || `MoneyPrinterTurbo HTTP ${response.status}`);
  }
  return data;
}

async function uploadMaterial(baseUrl: string, sourceUrl: string, expectedType: "image" | "video") {
  const { blob, extension } = await downloadPublicMedia(sourceUrl, expectedType);
  const filename = `tradepilot-${randomUUID()}.${extension}`;
  const form = new FormData();
  form.append("file", blob, filename);
  const response = await fetch(`${baseUrl}/api/v1/video_materials`, {
    method: "POST",
    headers: requestHeaders(),
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const result = await readJson<{ file?: string }>(response);
  if (!result.data?.file) throw new Error("MoneyPrinterTurbo 未返回素材文件名");
  return result.data.file;
}

export async function createMoneyPrinterTurboJob(
  product: StoredProduct,
  input: ProductVideoCreateInput,
): Promise<WorkerCreateResult> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error("MoneyPrinterTurbo 尚未配置，请先启动视频引擎");
  const sourceVideos = input.sourceVideos || [];
  if (input.sourceImages.length + sourceVideos.length === 0) throw new Error("MoneyPrinterTurbo 至少需要一个图片或视频素材");
  if (input.sourceImages.length + sourceVideos.length > MAX_SOURCE_MEDIA) throw new Error(`产品素材最多支持 ${MAX_SOURCE_MEDIA} 个`);

  const materialFiles: string[] = [];
  for (const sourceImage of input.sourceImages) {
    materialFiles.push(await uploadMaterial(baseUrl, sourceImage, "image"));
  }
  for (const sourceVideo of sourceVideos) {
    materialFiles.push(await uploadMaterial(baseUrl, sourceVideo, "video"));
  }

  const request = buildMoneyPrinterTurboVideoRequest(product, input, materialFiles);
  const response = await fetch(`${baseUrl}/api/v1/videos`, {
    method: "POST",
    headers: requestHeaders("application/json"),
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await readJson<{ task_id?: string }>(response);
  if (!result.data?.task_id) throw new Error("MoneyPrinterTurbo 未返回任务 ID");

  return {
    engine: "moneyprinterturbo",
    workerJobId: result.data.task_id,
    status: "queued",
    progress: 5,
    script: request.video_script,
    pipeline: "moneyprinterturbo",
  };
}

export async function refreshMoneyPrinterTurboJob(workerJobId: string): Promise<WorkerJobUpdate> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error("MoneyPrinterTurbo 尚未配置");
  const response = await fetch(`${baseUrl}/api/v1/tasks/${encodeURIComponent(workerJobId)}`, {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await readJson<MoneyPrinterTurboTask>(response);
  if (!result.data) throw new Error("MoneyPrinterTurbo 未返回任务状态");
  return mapMoneyPrinterTurboTask(result.data);
}

export async function deleteMoneyPrinterTurboJob(workerJobId: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return;
  const response = await fetch(`${baseUrl}/api/v1/tasks/${encodeURIComponent(workerJobId)}`, {
    method: "DELETE",
    headers: requestHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) await readJson(response);
}

export async function getMoneyPrinterTurboHealth(): Promise<VideoEngineHealth> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return { id: "moneyprinterturbo", label: "MoneyPrinterTurbo", configured: false, ok: false };
  try {
    const response = await fetch(`${baseUrl}/api/v1/tasks?page=1&page_size=1`, {
      headers: requestHeaders(),
      signal: AbortSignal.timeout(5_000),
    });
    return {
      id: "moneyprinterturbo",
      label: "MoneyPrinterTurbo",
      configured: true,
      ok: response.ok,
      url: baseUrl,
      detail: "AI 配音、字幕和多素材自动成片",
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error: unknown) {
    return {
      id: "moneyprinterturbo",
      label: "MoneyPrinterTurbo",
      configured: true,
      ok: false,
      url: baseUrl,
      error: error instanceof Error ? error.message : "MoneyPrinterTurbo 无法访问",
    };
  }
}

export function moneyPrinterTurboAssetUrl(path: string) {
  const baseUrl = getBaseUrl();
  const safePath = sanitizeWorkerAssetPath(path);
  if (!baseUrl || !safePath) throw new Error("MoneyPrinterTurbo 成片地址无效");
  return new URL(safePath, `${baseUrl}/`).toString();
}

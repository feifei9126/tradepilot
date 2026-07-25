import type { ProductVideoEngine, StoredProduct, StoredProductVideoJob } from "../store";
import {
  createMoneyPrinterTurboJob,
  deleteMoneyPrinterTurboJob,
  getMoneyPrinterTurboHealth,
  moneyPrinterTurboAssetUrl,
  refreshMoneyPrinterTurboJob,
} from "./moneyprinterturbo";
import {
  createOpenMontageJob,
  deleteOpenMontageJob,
  getOpenMontageHealth,
  normalizeLegacyEngine,
  openMontageAssetUrl,
  refreshOpenMontageJob,
} from "./openmontage";
import type { ProductVideoCreateInput, VideoEngineHealthMap } from "./types";

export type { ProductVideoCreateInput, VideoEngineHealthMap } from "./types";

function jobEngine(job: StoredProductVideoJob): ProductVideoEngine {
  return normalizeLegacyEngine(job.engine || job.workerMode);
}

export async function createProductVideoJob(product: StoredProduct, input: ProductVideoCreateInput) {
  if (input.engine === "moneyprinterturbo") return createMoneyPrinterTurboJob(product, input);
  return createOpenMontageJob(product, input);
}

export async function refreshProductVideoJob(job: StoredProductVideoJob) {
  if (!job.workerJobId) return null;
  return jobEngine(job) === "moneyprinterturbo"
    ? refreshMoneyPrinterTurboJob(job.workerJobId)
    : refreshOpenMontageJob(job.workerJobId);
}

export async function deleteProductVideoJob(job: StoredProductVideoJob) {
  if (!job.workerJobId) return;
  if (jobEngine(job) === "moneyprinterturbo") {
    await deleteMoneyPrinterTurboJob(job.workerJobId);
    return;
  }
  await deleteOpenMontageJob(job.workerJobId);
}

export async function getVideoEngineHealth(): Promise<VideoEngineHealthMap> {
  const [adapter, moneyprinterturbo] = await Promise.all([
    getOpenMontageHealth(),
    getMoneyPrinterTurboHealth(),
  ]);
  return {
    local: adapter.local,
    moneyprinterturbo,
    openmontage: adapter.openmontage,
  };
}

export function getWorkerAssetUrl(job: StoredProductVideoJob, kind: "video" | "thumbnail") {
  const path = kind === "video" ? job.workerVideoPath : job.workerThumbnailPath;
  if (!path) throw new Error("成片文件尚未生成");
  return jobEngine(job) === "moneyprinterturbo"
    ? moneyPrinterTurboAssetUrl(path)
    : openMontageAssetUrl(path);
}

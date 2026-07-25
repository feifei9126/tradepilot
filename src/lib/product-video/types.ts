import type {
  ProductVideoEngine,
  ProductVideoStatus,
  StoredProduct,
  StoredProductVideoJob,
} from "../store";

export type ProductVideoCreateInput = {
  productId: string;
  engine: ProductVideoEngine;
  style: string;
  language: string;
  duration: number;
  aspectRatio: string;
  sourceImages: string[];
  sourceVideos?: string[];
  brief: string;
};

export type WorkerCreateResult = {
  engine: ProductVideoEngine;
  workerJobId: string;
  status: ProductVideoStatus;
  progress: number;
  script?: string;
  workerVideoPath?: string;
  workerThumbnailPath?: string;
  pipeline: NonNullable<StoredProductVideoJob["pipeline"]>;
};

export type WorkerJobUpdate = Partial<Pick<
  StoredProductVideoJob,
  | "status"
  | "progress"
  | "script"
  | "workerVideoPath"
  | "workerThumbnailPath"
  | "error"
  | "pipeline"
>>;

export type VideoEngineHealth = {
  id: ProductVideoEngine;
  configured: boolean;
  ok: boolean;
  label: string;
  url?: string;
  error?: string;
  detail?: string;
};

export type VideoEngineHealthMap = Record<ProductVideoEngine, VideoEngineHealth>;

export type VideoEngineCreate = (
  product: StoredProduct,
  input: ProductVideoCreateInput,
) => Promise<WorkerCreateResult>;

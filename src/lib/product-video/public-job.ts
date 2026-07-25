import type { StoredProductVideoJob } from "../store";

export function publicProductVideoJob(job: StoredProductVideoJob) {
  const {
    workerVideoPath,
    workerThumbnailPath,
    videoUrl: legacyVideoUrl,
    thumbnailUrl: legacyThumbnailUrl,
    ...publicJob
  } = job;

  return {
    ...publicJob,
    videoUrl: workerVideoPath
      ? `/api/product-videos/${encodeURIComponent(job.id)}/asset`
      : legacyVideoUrl,
    thumbnailUrl: workerThumbnailPath
      ? `/api/product-videos/${encodeURIComponent(job.id)}/asset?kind=thumbnail`
      : legacyThumbnailUrl,
  };
}

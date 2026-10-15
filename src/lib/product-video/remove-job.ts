import { deleteProductVideoJob } from "./engine";
import type { StoredProductVideoJob } from "../store";

export async function removeProductVideoJob(
  job: StoredProductVideoJob,
  repository: { delete: (id: string) => Promise<boolean> },
  removeWorkerJob: (
    job: StoredProductVideoJob,
  ) => Promise<void> = deleteProductVideoJob,
) {
  let warning: string | undefined;
  try {
    await removeWorkerJob(job);
  } catch (error: unknown) {
    warning =
      error instanceof Error ? error.message : "Worker 输出文件清理失败";
  }

  const deleted = await repository.delete(job.id);
  return { deleted, warning };
}

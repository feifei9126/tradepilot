import { NextRequest, NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import {
  deleteProductVideoJob,
  refreshProductVideoJob,
} from "@/lib/product-video/engine";
import {
  productVideoJobs,
  type ProductVideoJobRepository,
} from "@/lib/product-video/job-repository";
import { publicProductVideoJob } from "@/lib/product-video/public-job";
import type { StoredProductVideoJob } from "@/lib/store";

export async function removeProductVideoJob(
  job: StoredProductVideoJob,
  repository: Pick<ProductVideoJobRepository, "delete"> = productVideoJobs,
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = requireBusinessContext(req);
    const { id } = await params;
    const job = await productVideoJobs.get(id);
    if (!job || job.companyId !== context.companyId) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    const update = await refreshProductVideoJob(job);
    if (update) {
      const refreshed = await productVideoJobs.update(id, update);
      return NextResponse.json(publicProductVideoJob(refreshed || job));
    }
    return NextResponse.json(publicProductVideoJob(job));
  } catch (error: unknown) {
    if (error instanceof BusinessError) return businessErrorResponse(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "刷新任务状态失败" },
      { status: 502 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = requireBusinessContext(req);
    const { id } = await params;
    const job = await productVideoJobs.get(id);
    if (!job || job.companyId !== context.companyId) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    return NextResponse.json(await removeProductVideoJob(job));
  } catch (error) {
    return businessErrorResponse(error);
  }
}

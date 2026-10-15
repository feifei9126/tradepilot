import { NextRequest, NextResponse } from "next/server";
import {
  refreshProductVideoJob,
} from "@/lib/product-video/engine";
import { publicProductVideoJob } from "@/lib/product-video/public-job";
import { removeProductVideoJob } from "@/lib/product-video/remove-job";
import { getStore } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { CrmError } from "@/lib/crm-repository";
import { DatabaseUnavailableError } from "@/db";

async function handleGET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await getStore().productVideoJobs.get(id);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  try {
    const update = await refreshProductVideoJob(job);
    if (update) {
      const refreshed = await getStore().productVideoJobs.update(id, update);
      return NextResponse.json(publicProductVideoJob(refreshed || job));
    }
    return NextResponse.json(publicProductVideoJob(job));
  } catch (error: unknown) {
    if (error instanceof CrmError || error instanceof DatabaseUnavailableError) throw error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "刷新任务状态失败" },
      { status: 502 },
    );
  }
}

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await getStore().productVideoJobs.get(id);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  return NextResponse.json(await removeProductVideoJob(job, getStore().productVideoJobs));
}

export const GET = withTenant(handleGET);
export const DELETE = withTenant(handleDELETE);

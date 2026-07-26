import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import {
  createProductVideoJob,
  type ProductVideoCreateInput,
} from "@/lib/product-video/engine";
import { productVideoJobs } from "@/lib/product-video/job-repository";
import { publicProductVideoJob } from "@/lib/product-video/public-job";
import { getBusinessRepository } from "@/lib/repositories";
import type { StoredProductVideoJob } from "@/lib/store";

type CreateVideoRequest = ProductVideoCreateInput;

const STYLES = new Set([
  "b2b-showcase",
  "factory-demo",
  "tiktok-short",
  "trade-fair",
  "inquiry-reply",
]);
const LANGUAGES = new Set(["zh", "en", "es", "de", "fr"]);
const ASPECT_RATIOS = new Set(["9:16", "16:9", "1:1"]);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    const context = requireBusinessContext(req);
    return NextResponse.json(
      (await productVideoJobs.list())
        .filter((job) => job.companyId === context.companyId)
        .map(publicProductVideoJob),
    );
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = requireBusinessContext(req);
    const repository = await getBusinessRepository(context);
    const body = (await req.json()) as CreateVideoRequest;
    if (!body.productId) return badRequest("请选择产品");
    if (!STYLES.has(body.style)) return badRequest("请选择有效的视频风格");
    if (!LANGUAGES.has(body.language))
      return badRequest("请选择有效的视频语言");
    const engine = body.engine || "local";
    if (!["local", "moneyprinterturbo", "openmontage"].includes(engine)) {
      return badRequest("不支持的视频引擎");
    }
    const duration = Number(body.duration) || 30;
    if (![15, 30, 60].includes(duration))
      return badRequest("视频时长只支持 15、30 或 60 秒");
    const sourceImages = Array.isArray(body.sourceImages)
      ? body.sourceImages.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const sourceVideos = Array.isArray(body.sourceVideos)
      ? body.sourceVideos.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const brief =
      typeof body.brief === "string" ? body.brief.trim().slice(0, 5_000) : "";
    if (sourceImages.length + sourceVideos.length > 6)
      return badRequest("产品图片和视频素材合计最多支持 6 个");
    if (!ASPECT_RATIOS.has(body.aspectRatio || "9:16"))
      return badRequest("不支持的视频画幅");
    if (
      engine === "moneyprinterturbo" &&
      sourceImages.length + sourceVideos.length === 0
    ) {
      return badRequest("MoneyPrinterTurbo 至少需要一个图片或视频素材");
    }

    const product = await repository.products.get(body.productId);
    if (!product)
      return NextResponse.json({ error: "产品不存在" }, { status: 404 });

    const workerResult = await createProductVideoJob(product, {
      productId: body.productId,
      engine,
      style: body.style,
      language: body.language,
      duration,
      aspectRatio: body.aspectRatio || "9:16",
      sourceImages,
      sourceVideos,
      brief,
    });

    const now = new Date().toISOString();
    const job: StoredProductVideoJob = {
      id: `pv_${randomUUID()}`,
      companyId: context.companyId,
      productId: product.id,
      productName: product.name,
      title: `${product.name} 产品视频`,
      style: body.style,
      language: body.language,
      duration,
      aspectRatio: body.aspectRatio || "9:16",
      status: workerResult.status,
      progress: workerResult.progress,
      engine: workerResult.engine,
      workerMode: workerResult.engine,
      workerJobId: workerResult.workerJobId,
      workerVideoPath: workerResult.workerVideoPath,
      workerThumbnailPath: workerResult.workerThumbnailPath,
      sourceImages,
      sourceVideos,
      brief,
      script: workerResult.script,
      pipeline: workerResult.pipeline,
      createdAt: now,
      updatedAt: now,
    };

    await productVideoJobs.add(job);
    return NextResponse.json(publicProductVideoJob(job), { status: 201 });
  } catch (error: unknown) {
    if (error instanceof BusinessError) return businessErrorResponse(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "创建产品视频任务失败",
      },
      { status: 502 },
    );
  }
}

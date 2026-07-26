import { NextRequest, NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { getWorkerAssetUrl } from "@/lib/product-video/engine";
import { productVideoJobs } from "@/lib/product-video/job-repository";

const FORWARDED_HEADERS = [
  "accept-ranges",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
] as const;

async function proxyAsset(
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
    const kind = req.nextUrl.searchParams.get("kind") === "thumbnail" ? "thumbnail" : "video";
    const upstreamUrl = getWorkerAssetUrl(job, kind);
    const headers = new Headers();
    const range = req.headers.get("range");
    if (range) headers.set("Range", range);

    const response = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok && response.status !== 206) {
      return NextResponse.json({ error: `Worker 成片读取失败：HTTP ${response.status}` }, { status: response.status });
    }

    const responseHeaders = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("Cache-Control", "private, no-store");
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    return new NextResponse(req.method === "HEAD" ? null : response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    if (error instanceof BusinessError) return businessErrorResponse(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取成片失败" },
      { status: 502 },
    );
  }
}

export const GET = proxyAsset;
export const HEAD = proxyAsset;

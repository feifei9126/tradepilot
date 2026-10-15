import { mediaDeliveryPolicy } from "@/lib/media-content";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/tenant-route";
import { currentWorkspace } from "@/lib/workspace-context";
import { deleteMediaAsset, getMediaAsset, getMediaDownloadUrl, mediaAssetMetadata, mediaPublicView, openMediaAssetStream } from "@/lib/media-assets";
import { CrmError } from "@/lib/crm-repository";
import { parseByteRange, RangeNotSatisfiableError } from "@/lib/http-byte-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function etagMatches(value: string | null, etag: string) {
  if (!value) return false;
  return value.split(",").some(candidate => candidate.trim() === "*" || candidate.trim() === etag || candidate.trim() === `W/${etag}`);
}

async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const workspace = currentWorkspace();
  if (!workspace) throw new CrmError("工作区上下文不存在", 500);
  const { id } = await params;
  const asset = await getMediaAsset(workspace.companyId, id);
  if (!asset) return NextResponse.json({ error: "媒体文件不存在" }, { status: 404 });
  if (request.nextUrl.searchParams.get("metadata") === "1") {
    return NextResponse.json({ asset: { ...mediaPublicView(asset), signedUrl: await getMediaDownloadUrl(asset) } }, { headers: { "Cache-Control": "no-store, private" } });
  }

  const metadata = await mediaAssetMetadata(asset);
  const etag = metadata.etag || `"${asset.sha256}"`;
  const policy = mediaDeliveryPolicy(asset);
  const headers = new Headers({
    "Content-Type": policy.contentType,
    "Content-Disposition": policy.disposition,
    "Content-Security-Policy": policy.csp,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    ETag: etag,
  });
  if (etagMatches(request.headers.get("if-none-match"), etag)) return new NextResponse(null, { status: 304, headers });

  let range: ReturnType<typeof parseByteRange> = null;
  const rangeHeader = request.headers.get("range");
  const ifRange = request.headers.get("if-range");
  const useRange = rangeHeader && (!ifRange || ifRange === etag);
  try {
    if (useRange) range = parseByteRange(rangeHeader, metadata.contentLength ?? asset.sizeBytes);
  } catch (error) {
    if (error instanceof RangeNotSatisfiableError) {
      headers.set("Content-Range", `bytes */${metadata.contentLength ?? asset.sizeBytes}`);
      return new NextResponse(null, { status: 416, headers });
    }
    throw error;
  }

  const size = metadata.contentLength ?? asset.sizeBytes;
  const length = range ? range.end - range.start + 1 : size;
  headers.set("Content-Length", String(length));
  if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  if (request.method === "HEAD") return new NextResponse(null, { status: range ? 206 : 200, headers });

  const object = await openMediaAssetStream(asset, range || undefined);
  return new NextResponse(object.stream, { status: range ? 206 : 200, headers });
}

async function handleHEAD(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleGET(request, context);
}

async function handleDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const workspace = currentWorkspace();
  if (!workspace) throw new CrmError("工作区上下文不存在", 500);
  const { id } = await params;
  return NextResponse.json(await deleteMediaAsset(workspace.companyId, id, workspace.userId, ["owner", "admin"].includes(workspace.role)));
}

export const GET = withTenant(handleGET);
export const HEAD = withTenant(handleHEAD);
export const DELETE = withTenant(handleDELETE);

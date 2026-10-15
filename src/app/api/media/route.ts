import { boundedBytes } from "@/lib/request-json";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/tenant-route";
import { currentWorkspace } from "@/lib/workspace-context";
import { createMediaAsset, listMediaAssets, maxMediaBytes, mediaPublicView } from "@/lib/media-assets";
import { CrmError } from "@/lib/crm-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(request: NextRequest) {
  const workspace = currentWorkspace();
  if (!workspace) throw new CrmError("工作区上下文不存在", 500);
  const kind = request.nextUrl.searchParams.get("kind") || undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
  return NextResponse.json({ assets: (await listMediaAssets(workspace.companyId, { kind, limit })).map(mediaPublicView) });
}

async function handlePOST(request: NextRequest) {
  const workspace = currentWorkspace();
  if (!workspace) throw new CrmError("工作区上下文不存在", 500);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxMediaBytes() + 2 * 1024 * 1024) throw new CrmError("上传文件过大", 413);
  const bytes = await boundedBytes(request, maxMediaBytes() + 2 * 1024 * 1024);
  let form: FormData;
  try { form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData(); }
  catch { throw new CrmError("上传表单格式不正确", 400); }
  const file = form.get("file");
  const kind = String(form.get("kind") || "attachment");
  if (!(file instanceof File)) throw new CrmError("请选择要上传的文件", 400);
  if (file.size > maxMediaBytes()) throw new CrmError(`文件大小不能超过 ${Math.floor(maxMediaBytes() / 1024 / 1024)} MB`, 413);
  const body = Buffer.from(await file.arrayBuffer());
  const asset = await createMediaAsset({ companyId: workspace.companyId, actorId: workspace.userId, kind, filename: file.name, mimeType: file.type || "application/octet-stream", body });
  return NextResponse.json({ asset: mediaPublicView(asset) }, { status: 201 });
}

export const GET = withTenant(handleGET);
export const POST = withTenant(handlePOST);

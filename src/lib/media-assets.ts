import { mediaDeliveryPolicy, validatedMediaType } from "./media-content";
import { createHash, randomUUID } from "node:crypto";
import { query } from "@/db";
import { CrmError } from "@/lib/crm-repository";
import { deleteObject, objectMetadata, openObjectStream, publicMediaObjectUrl, putObject, readObject, sanitizeFilename, signedObjectUrl, storageProvider, type ObjectMetadata } from "@/lib/object-storage";
import type { ByteRange } from "@/lib/http-byte-range";

export type MediaAsset = {
  id: string;
  companyId: string;
  objectKey: string;
  kind: string;
  filename: string;
  mimeType: string;
  verifiedMimeType: string | null;
  sizeBytes: number;
  sha256: string;
  storageProvider: "local" | "s3";
  status: "pending" | "ready" | "failed" | "deleted";
  createdBy: string | null;
  createdAt: string;
  deletedAt: string | null;
};

function rowToAsset(row: Record<string, unknown>): MediaAsset {
  return { id: String(row.id), companyId: String(row.company_id), objectKey: String(row.object_key), kind: String(row.kind), filename: String(row.filename), mimeType: String(row.mime_type), verifiedMimeType: typeof row.verified_mime_type === "string" ? row.verified_mime_type : null, sizeBytes: Number(row.size_bytes), sha256: String(row.sha256), storageProvider: row.storage_provider === "s3" ? "s3" : "local", status: row.status as MediaAsset["status"], createdBy: row.created_by ? String(row.created_by) : null, createdAt: new Date(row.created_at as string).toISOString(), deletedAt: row.deleted_at ? new Date(row.deleted_at as string).toISOString() : null };
}

function validKind(value: string) {
  const kind = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,50}$/.test(kind)) throw new CrmError("媒体类型无效", 400);
  return kind;
}

function validCompanyId(value: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new CrmError("工作区标识无效", 400);
}

export function maxMediaBytes() {
  const configured = Number(process.env.TRADEPILOT_MEDIA_MAX_BYTES || 100 * 1024 * 1024);
  return Number.isInteger(configured) && configured >= 1_048_576 && configured <= 2 * 1024 * 1024 * 1024 ? configured : 100 * 1024 * 1024;
}

export function mediaPublicView(asset: MediaAsset) {
  return { ...asset, downloadUrl: `/api/media/${encodeURIComponent(asset.id)}`, signedUrl: null };
}

export async function listMediaAssets(companyId: string, input: { kind?: string; limit?: number } = {}) {
  validCompanyId(companyId);
  const limit = Math.min(Math.max(Math.trunc(input.limit || 50), 1), 200);
  const values: unknown[] = [companyId];
  let where = "company_id=$1 AND status <> 'deleted'";
  if (input.kind?.trim()) { values.push(validKind(input.kind)); where += ` AND kind=$${values.length}`; }
  values.push(limit);
  const result = await query(`SELECT * FROM media_assets WHERE ${where} ORDER BY created_at DESC LIMIT $${values.length}`, values);
  return result.rows.map(rowToAsset);
}

export async function getMediaAsset(companyId: string, id: string, includeDeleted = false) {
  validCompanyId(companyId);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const result = await query(`SELECT * FROM media_assets WHERE company_id=$1 AND id=$2 ${includeDeleted ? "" : "AND status <> 'deleted'"}`, [companyId, id]);
  return result.rows[0] ? rowToAsset(result.rows[0]) : null;
}

export async function createMediaAsset(input: { companyId: string; actorId: string; kind: string; filename: string; mimeType: string; body: Buffer }) {
  validCompanyId(input.companyId);
  if (input.body.byteLength > maxMediaBytes()) throw new CrmError(`文件大小不能超过 ${Math.floor(maxMediaBytes() / 1024 / 1024)} MB`, 413);
  const filename = sanitizeFilename(input.filename);
  const kind = validKind(input.kind);
  const mimeType = validatedMediaType(input.body, filename, input.mimeType);
  const sha256 = createHash("sha256").update(input.body).digest("hex");
  const id = randomUUID();
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const now = new Date();
  const objectKey = `${input.companyId}/${kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}${extension}`;
  await query("INSERT INTO media_assets(id,company_id,object_key,kind,filename,mime_type,size_bytes,sha256,storage_provider,status,created_by,verified_mime_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$6)", [id, input.companyId, objectKey, kind, filename, mimeType, input.body.byteLength, sha256, storageProvider(), /^[0-9a-f-]{36}$/i.test(input.actorId) ? input.actorId : null]);
  try {
    await putObject({ key: objectKey, body: input.body, contentType: mimeType });
    const result = await query("UPDATE media_assets SET status='ready' WHERE company_id=$1 AND id=$2 RETURNING *", [input.companyId, id]);
    return rowToAsset(result.rows[0]);
  } catch (error) {
    await query("UPDATE media_assets SET status='failed' WHERE company_id=$1 AND id=$2", [input.companyId, id]).catch(() => {});
    throw new CrmError(error instanceof Error ? error.message : "媒体保存失败", 503);
  }
}

export async function readMediaAsset(asset: MediaAsset) {
  if (asset.status !== "ready") throw new CrmError("媒体文件尚未准备好", 409);
  return readObject(asset.objectKey, asset.storageProvider);
}

export async function mediaAssetMetadata(asset: MediaAsset): Promise<ObjectMetadata> {
  if (asset.status !== "ready") throw new CrmError("媒体文件尚未准备好", 409);
  return objectMetadata(asset.objectKey, asset.storageProvider);
}

export async function openMediaAssetStream(asset: MediaAsset, range?: ByteRange) {
  if (asset.status !== "ready") throw new CrmError("媒体文件尚未准备好", 409);
  return openObjectStream(asset.objectKey, asset.storageProvider, range);
}

export async function getMediaDownloadUrl(asset: MediaAsset, expiresIn = 300) {
  return asset.storageProvider === "s3"
    ? signedObjectUrl(asset.objectKey, expiresIn, mediaDeliveryPolicy(asset))
    : publicMediaObjectUrl(asset.id);
}

export async function deleteMediaAsset(companyId: string, id: string, actorId: string, canDeleteAll = false) {
  const asset = await getMediaAsset(companyId, id);
  if (!asset) throw new CrmError("媒体文件不存在", 404);
  if (!canDeleteAll && asset.createdBy && asset.createdBy !== actorId) throw new CrmError("只有上传者或管理员可以删除媒体", 403);
  await deleteObject(asset.objectKey, asset.storageProvider);
  await query("UPDATE media_assets SET status='deleted',deleted_at=now() WHERE company_id=$1 AND id=$2", [companyId, id]);
  await query("INSERT INTO audit_events(company_id,actor_id,action,target_id,details) VALUES($1,$2,'media.delete',$3,$4::jsonb)", [companyId, actorId, id, JSON.stringify({ kind: asset.kind, sha256: asset.sha256 })]).catch(() => {});
  return { ok: true, id };
}

export async function persistVideoAsset(input: { companyId: string; actorId: string; jobId: string; kind: "video" | "thumbnail"; body: Buffer; filename: string; mimeType: string }) {
  return createMediaAsset({ companyId: input.companyId, actorId: input.actorId, kind: `video-${input.kind}`, filename: input.filename, mimeType: input.mimeType, body: input.body });
}

export function mediaAssetUrl(asset: MediaAsset) {
  return publicMediaObjectUrl(asset.id);
}

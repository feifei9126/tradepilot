import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, type ServerSideEncryption } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ByteRange } from "@/lib/http-byte-range";

export type StorageProvider = "local" | "s3";
export type ObjectMetadata = { contentType?: string; contentLength?: number; etag?: string };

const DEFAULT_MEDIA_DIR = "/app/data/media";

function configuredS3() {
  return Boolean(process.env.S3_BUCKET?.trim() && process.env.S3_ACCESS_KEY_ID?.trim() && process.env.S3_SECRET_ACCESS_KEY?.trim());
}

export function storageProvider(): StorageProvider {
  return configuredS3() ? "s3" : "local";
}

export function mediaDirectory() {
  const configured = process.env.TRADEPILOT_MEDIA_DIR?.trim();
  const value = configured || DEFAULT_MEDIA_DIR;
  return isAbsolute(value) ? value : resolve(/*turbopackIgnore: true*/ process.cwd(), value);
}

function safeKey(key: string) {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.length > 500 || normalized.split("/").some(part => !part || part === "." || part === "..")) throw new Error("媒体对象路径无效");
  return normalized;
}

function localPath(key: string) {
  const root = resolve(mediaDirectory());
  const target = resolve(join(root, safeKey(key)));
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("媒体对象路径无效");
  return target;
}

let s3: S3Client | undefined;
function s3Client() {
  if (!configuredS3()) throw new Error("对象存储尚未配置");
  s3 ??= new S3Client({
    region: process.env.S3_REGION?.trim() || "auto",
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(), secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim() },
  });
  return s3;
}

function bucket() {
  const value = process.env.S3_BUCKET?.trim();
  if (!value) throw new Error("S3_BUCKET 尚未配置");
  return value;
}

export function publicMediaObjectUrl(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("媒体资源标识无效");
  return `/api/media/${encodeURIComponent(id)}`;
}

export async function putObject(input: { key: string; body: Uint8Array | Buffer; contentType: string }, provider: StorageProvider = storageProvider()) {
  const key = safeKey(input.key);
  if (provider === "s3") {
    const configuredEncryption = process.env.S3_SERVER_SIDE_ENCRYPTION?.trim();
    const serverSideEncryption: ServerSideEncryption | undefined = configuredEncryption === "AES256" || configuredEncryption === "aws:kms" ? configuredEncryption : undefined;
    await s3Client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: input.body, ContentType: input.contentType, ...(serverSideEncryption ? { ServerSideEncryption: serverSideEncryption } : {}) }));
    return { provider: "s3" as const, key };
  }
  const target = localPath(key);
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, input.body, { mode: 0o600 });
  return { provider: "local" as const, key };
}

export async function readObject(key: string, provider: StorageProvider = storageProvider()): Promise<{ body: Buffer; contentType?: string; contentLength: number; etag?: string }> {
  const normalized = safeKey(key);
  if (provider === "s3") {
    const response = await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: normalized }));
    const body = response.Body;
    if (!body) throw new Error("对象存储返回空文件");
    const bytes = await body.transformToByteArray();
    return { body: Buffer.from(bytes), contentType: response.ContentType, contentLength: bytes.byteLength, etag: response.ETag };
  }
  const target = localPath(normalized);
  const [body, info] = await Promise.all([readFile(target), stat(target)]);
  return { body, contentLength: info.size };
}

export async function objectMetadata(key: string, provider: StorageProvider = storageProvider()): Promise<ObjectMetadata> {
  const normalized = safeKey(key);
  if (provider === "s3") {
    const response = await s3Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: normalized }));
    return { contentType: response.ContentType, contentLength: response.ContentLength, etag: response.ETag };
  }
  const info = await stat(localPath(normalized));
  return { contentLength: info.size };
}

export async function deleteObject(key: string, provider: StorageProvider = storageProvider()) {
  const normalized = safeKey(key);
  if (provider === "s3") {
    await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: normalized }));
    return;
  }
  await unlink(localPath(normalized)).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
}

export async function signedObjectUrl(key: string, expiresIn = 300, policy: { contentType: string; disposition: string } = { contentType: "application/octet-stream", disposition: "attachment" }) {
  const normalized = safeKey(key);
  if (storageProvider() !== "s3") throw new Error("本地对象存储需要通过媒体鉴权接口读取");
  return getSignedUrl(s3Client(), new GetObjectCommand({ Bucket: bucket(), Key: normalized, ResponseContentType: policy.contentType, ResponseContentDisposition: policy.disposition }), { expiresIn });
}

export async function openObjectStream(key: string, provider: StorageProvider = storageProvider(), range?: ByteRange) {
  const normalized = safeKey(key);
  if (provider === "s3") {
    const response = await s3Client().send(new GetObjectCommand({
      Bucket: bucket(),
      Key: normalized,
      ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
    }));
    const stream = objectBodyToWebStream(response.Body);
    if (!stream) throw new Error("对象存储返回空文件");
    return {
      stream,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      etag: response.ETag,
      contentRange: response.ContentRange,
    };
  }

  const info = await stat(localPath(normalized));
  const start = range?.start;
  const end = range?.end;
  const stream = createReadStream(localPath(normalized), start === undefined ? undefined : { start, end });
  return {
    stream: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
    contentLength: start === undefined ? info.size : end! - start + 1,
  };
}

export function objectBodyToWebStream(body: unknown): ReadableStream<Uint8Array> | null {
  if (body instanceof Readable) return Readable.toWeb(body) as ReadableStream<Uint8Array>;
  if (body && typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function") return (body as { transformToWebStream: () => ReadableStream<Uint8Array> }).transformToWebStream();
  return null;
}

export function sanitizeFilename(value: string) {
  const clean = basename(value).replace(/[\u0000-\u001f\u007f/\\]+/g, "_").trim();
  return clean.slice(0, 255) || "upload.bin";
}

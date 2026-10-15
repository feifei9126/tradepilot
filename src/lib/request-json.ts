/** Stream the request so a forged/missing Content-Length cannot bypass byte limits. */
export class RequestBodyError extends Error {
  constructor(message: string, public status: 400 | 413) { super(message); }
}
export async function boundedBytes(request: Request, maxBytes: number): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new TypeError("maxBytes must be a non-negative safe integer");
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError("请求为空", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyError("请求过大，请缩小内容后重试", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}
export async function boundedText(request: Request, maxBytes: number): Promise<string> {
  return (await boundedBytes(request, maxBytes)).toString("utf8");
}
export async function boundedJson(request: Request, maxBytes = 64000): Promise<unknown> {
  const bytes = await boundedBytes(request, maxBytes);
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { throw new RequestBodyError("JSON 格式不正确", 400); }
}

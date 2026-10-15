import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedJson, boundedText, RequestBodyError } from "../../src/lib/request-json";
const request = (body: string, headers: Record<string, string> = {}) => new Request("http://localhost/api/test", { method: "POST", headers, body });
test("bounded JSON accepts valid UTF-8 and enforces bytes, not characters/Content-Length", async () => {
  assert.deepEqual(await boundedJson(request('{"name":"中文"}')), { name: "中文" });
  await assert.rejects(boundedJson(request(JSON.stringify({ text: "中".repeat(22000) }), { "Content-Length": "1" })), e => e instanceof RequestBodyError && e.status === 413);
});
test("bounded JSON reports empty/malformed bodies as input failures", async () => {
  await assert.rejects(boundedJson(new Request("http://localhost")), e => e instanceof RequestBodyError && e.status === 400);
  await assert.rejects(boundedJson(request("{bad")), e => e instanceof RequestBodyError && e.status === 400);
});
test("bounded JSON cancels a chunked oversized stream and releases its lock", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(64001)); }, cancel() { cancelled = true; } });
  const req = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(boundedJson(req), e => e instanceof RequestBodyError && e.status === 413);
  assert.equal(cancelled, true); assert.equal(stream.locked, false);
});

test("bounded text preserves the exact UTF-8 body and enforces its byte limit", async () => {
  const payload = '{"message":"签名原文"}';
  assert.equal(await boundedText(request(payload), Buffer.byteLength(payload)), payload);
  await assert.rejects(boundedText(request("中"), 2), e => e instanceof RequestBodyError && e.status === 413);
});

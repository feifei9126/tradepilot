import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseByteRange, RangeNotSatisfiableError } from "../../src/lib/http-byte-range";
import { openObjectStream } from "../../src/lib/object-storage";

async function readWebStream(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString("utf8");
    chunks.push(value);
  }
}

test("byte range parser supports bounded, open-ended and suffix ranges", () => {
  assert.deepEqual(parseByteRange("bytes=1-3", 10), { start: 1, end: 3 });
  assert.deepEqual(parseByteRange("bytes=8-", 10), { start: 8, end: 9 });
  assert.deepEqual(parseByteRange("bytes=-4", 10), { start: 6, end: 9 });
  assert.deepEqual(parseByteRange("bytes=0-99", 10), { start: 0, end: 9 });
  assert.equal(parseByteRange(null, 10), null);
  assert.throws(() => parseByteRange("bytes=10-", 10), RangeNotSatisfiableError);
  assert.throws(() => parseByteRange("bytes=2-1", 10), RangeNotSatisfiableError);
  assert.throws(() => parseByteRange("bytes=0-1,4-5", 10), RangeNotSatisfiableError);
  assert.throws(() => parseByteRange("bytes=-0", 10), RangeNotSatisfiableError);
});

test("local object downloads stream only the requested byte range", async () => {
  const root = await mkdtemp(join(tmpdir(), "tradepilot-media-"));
  try {
    process.env.TRADEPILOT_MEDIA_DIR = root;
    await mkdir(join(root, "tenant", "media"), { recursive: true });
    await writeFile(join(root, "tenant", "media", "sample.txt"), "abcdefghij");
    const range = parseByteRange("bytes=2-5", 10)!;
    const opened = await openObjectStream("tenant/media/sample.txt", "local", range);
    assert.equal(opened.contentLength, 4);
    assert.equal(await readWebStream(opened.stream), "cdef");
  } finally {
    delete process.env.TRADEPILOT_MEDIA_DIR;
    await rm(root, { recursive: true, force: true });
  }
});

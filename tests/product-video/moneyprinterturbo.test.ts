import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMoneyPrinterTurboVideoRequest,
  createMoneyPrinterTurboJob,
  isPrivateAddress,
  mapMoneyPrinterTurboTask,
  moneyPrinterTurboAssetUrl,
  sanitizeWorkerAssetPath,
} from "../../src/lib/product-video/moneyprinterturbo";

test("uploads a scraped MP4 and includes it in the MoneyPrinterTurbo task", async () => {
  const previousUrl = process.env.MONEYPRINTERTURBO_URL;
  const originalFetch = globalThis.fetch;
  let uploadedName = "";
  let videoRequest: Record<string, unknown> = {};
  process.env.MONEYPRINTERTURBO_URL = "http://moneyprinterturbo.test:8080";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "https://1.1.1.1/product-demo.mp4") {
      return new Response(new Uint8Array([0, 0, 0, 20]), {
        headers: { "Content-Type": "video/mp4", "Content-Length": "4" },
      });
    }
    if (url.endsWith("/api/v1/video_materials")) {
      const file = (init?.body as FormData).get("file") as File;
      uploadedName = file.name;
      return Response.json({ status: 200, data: { file: "tradepilot-product-demo.mp4" } });
    }
    if (url.endsWith("/api/v1/videos")) {
      videoRequest = JSON.parse(String(init?.body));
      return Response.json({ status: 200, data: { task_id: "task-video-1" } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const result = await createMoneyPrinterTurboJob(
      { id: "p1", name: "Portable charger", unit: "piece" },
      {
        productId: "p1",
        engine: "moneyprinterturbo",
        style: "tiktok-short",
        language: "en",
        duration: 30,
        aspectRatio: "9:16",
        sourceImages: [],
        sourceVideos: ["https://1.1.1.1/product-demo.mp4"],
        brief: "Re-edit the source video.",
      },
    );
    assert.equal(result.workerJobId, "task-video-1");
    assert.match(uploadedName, /\.mp4$/);
    assert.deepEqual(videoRequest.video_materials, [
      { provider: "local", url: "tradepilot-product-demo.mp4", duration: 0 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.MONEYPRINTERTURBO_URL;
    else process.env.MONEYPRINTERTURBO_URL = previousUrl;
  }
});

test("builds a local-material MoneyPrinterTurbo request without requiring an LLM", () => {
  const request = buildMoneyPrinterTurboVideoRequest(
    {
      id: "p1",
      name: "Portable charger",
      description: "65W fast charging",
      unit: "piece",
    },
    {
      productId: "p1",
      engine: "moneyprinterturbo",
      style: "tiktok-short",
      language: "en",
      duration: 30,
      aspectRatio: "9:16",
      sourceImages: ["https://cdn.example.com/product.jpg"],
      brief: "Emphasize airline-safe capacity.",
    },
    ["tp_job_product.jpg"],
  );

  assert.equal(request.video_source, "local");
  assert.equal(request.video_aspect, "9:16");
  assert.equal(request.video_count, 1);
  assert.equal(request.voice_name, "en-US-JennyNeural-Female");
  assert.match(request.video_script, /Portable charger/);
  assert.deepEqual(request.video_materials, [
    { provider: "local", url: "tp_job_product.jpg", duration: 0 },
  ]);
});

test("maps MoneyPrinterTurbo terminal and active task states", () => {
  assert.deepEqual(mapMoneyPrinterTurboTask({ state: 4, progress: 35 }), {
    status: "rendering",
    progress: 35,
    error: undefined,
    workerVideoPath: undefined,
  });
  assert.deepEqual(mapMoneyPrinterTurboTask({
    state: 1,
    progress: 100,
    videos: ["http://moneyprinterturbo:8080/tasks/task-1/final-1.mp4"],
  }), {
    status: "completed",
    progress: 100,
    error: undefined,
    workerVideoPath: "/tasks/task-1/final-1.mp4",
  });
  assert.deepEqual(mapMoneyPrinterTurboTask({ state: -1, progress: 30, error: "TTS failed" }), {
    status: "failed",
    progress: 30,
    error: "TTS failed",
    workerVideoPath: undefined,
  });
});

test("keeps only HTTP worker asset paths", () => {
  assert.equal(sanitizeWorkerAssetPath("/tasks/task-1/final-1.mp4"), "/tasks/task-1/final-1.mp4");
  assert.equal(
    sanitizeWorkerAssetPath("https://video.internal/tasks/task-1/final-1.mp4?download=1"),
    "/tasks/task-1/final-1.mp4?download=1",
  );
  assert.equal(sanitizeWorkerAssetPath("file:///etc/passwd"), undefined);
  assert.equal(sanitizeWorkerAssetPath("javascript:alert(1)"), undefined);
});

test("pins absolute worker asset URLs to the configured private worker", () => {
  const previousUrl = process.env.MONEYPRINTERTURBO_URL;
  process.env.MONEYPRINTERTURBO_URL = "http://moneyprinterturbo:8080";
  try {
    assert.equal(
      moneyPrinterTurboAssetUrl("https://untrusted.example/tasks/task-1/final.mp4?download=1"),
      "http://moneyprinterturbo:8080/tasks/task-1/final.mp4?download=1",
    );
  } finally {
    if (previousUrl === undefined) delete process.env.MONEYPRINTERTURBO_URL;
    else process.env.MONEYPRINTERTURBO_URL = previousUrl;
  }
});

test("detects loopback and private network addresses", () => {
  for (const address of ["127.0.0.1", "10.0.0.2", "172.16.1.2", "192.168.1.8", "169.254.1.1", "::1", "fc00::1", "fe80::1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  for (const address of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateAddress(address), false, address);
  }
});

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ProductVideoJobRepository } from "../../src/lib/product-video/job-repository";
import type { StoredProductVideoJob } from "../../src/lib/store";

function createJob(id: string): StoredProductVideoJob {
  const now = new Date().toISOString();
  return {
    id,
    productId: "p1",
    productName: "Test product",
    title: "Test product video",
    style: "b2b-showcase",
    language: "en",
    duration: 30,
    aspectRatio: "9:16",
    status: "queued",
    progress: 5,
    engine: "moneyprinterturbo",
    workerMode: "moneyprinterturbo",
    pipeline: "moneyprinterturbo",
    sourceImages: ["https://cdn.example.com/product.jpg"],
    brief: "Show the primary benefit.",
    createdAt: now,
    updatedAt: now,
  };
}

test("product video jobs survive repository recreation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tradepilot-video-jobs-"));
  const file = join(directory, "jobs.json");

  try {
    const first = new ProductVideoJobRepository(file);
    await first.add(createJob("job-1"));

    const restarted = new ProductVideoJobRepository(file);
    assert.deepEqual((await restarted.list()).map((job) => job.id), ["job-1"]);

    const updated = await restarted.update("job-1", {
      status: "rendering",
      progress: 42,
    });
    assert.equal(updated?.status, "rendering");

    const secondRestart = new ProductVideoJobRepository(file);
    assert.equal((await secondRestart.get("job-1"))?.progress, 42);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("concurrent repository writes do not drop jobs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tradepilot-video-jobs-"));
  const file = join(directory, "jobs.json");

  try {
    const repository = new ProductVideoJobRepository(file);
    await Promise.all(Array.from({ length: 8 }, (_, index) => repository.add(createJob(`job-${index}`))));

    const ids = (await repository.list()).map((job) => job.id).sort();
    assert.equal(ids.length, 8);
    assert.deepEqual(ids, Array.from({ length: 8 }, (_, index) => `job-${index}`).sort());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

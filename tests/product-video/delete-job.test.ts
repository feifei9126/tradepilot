import assert from "node:assert/strict";
import test from "node:test";

import { removeProductVideoJob } from "../../src/app/api/product-videos/[id]/route";
import type { StoredProductVideoJob } from "../../src/lib/store";

test("video task is removed even when Worker cleanup fails", async () => {
  const job: StoredProductVideoJob = {
    id: "delete-warning-job",
    productId: "p1",
    productName: "Test product",
    title: "Delete warning test",
    style: "b2b-showcase",
    language: "en",
    duration: 30,
    aspectRatio: "9:16",
    status: "completed",
    progress: 100,
    engine: "local",
    workerMode: "local",
    workerJobId: "worker-delete-warning",
    sourceImages: [],
    brief: "",
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };
  let repositoryDeleteId = "";

  const result = await removeProductVideoJob(
    job,
    {
      delete: async (id) => {
        repositoryDeleteId = id;
        return true;
      },
    },
    async () => {
      throw new Error("Worker cleanup unavailable");
    },
  );

  assert.equal(repositoryDeleteId, job.id);
  assert.equal(result.deleted, true);
  assert.equal(result.warning, "Worker cleanup unavailable");
});

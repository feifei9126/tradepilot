import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETE as deleteProductVideo,
  GET as getProductVideo,
} from "../../src/app/api/product-videos/[id]/route";
import { GET as getProductVideoAsset } from "../../src/app/api/product-videos/[id]/asset/route";
import { GET as listProductVideos } from "../../src/app/api/product-videos/route";
import { productVideoJobs } from "../../src/lib/product-video/job-repository";
import type { StoredProductVideoJob } from "../../src/lib/store";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

test("product video routes hide another tenant's jobs", async () => {
  const id = `pv_tenant_${Date.now()}`;
  const job: StoredProductVideoJob & { companyId: string } = {
    id,
    companyId: contextA.companyId,
    productId: "tenant-a-product",
    productName: "Tenant A Product",
    title: "Tenant A Product Video",
    style: "b2b-showcase",
    language: "en",
    duration: 15,
    aspectRatio: "9:16",
    status: "queued",
    progress: 0,
    engine: "local",
    workerMode: "local",
    sourceImages: [],
    sourceVideos: [],
    brief: "tenant isolation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await productVideoJobs.add(job);

  try {
    const listResponse = await listProductVideos(
      businessRequest("http://localhost/api/product-videos", {}, contextB),
    );
    const jobs = (await listResponse.json()) as { id: string }[];
    assert.equal(jobs.some((record) => record.id === id), false);

    const request = businessRequest(
      `http://localhost/api/product-videos/${id}`,
      {},
      contextB,
    );
    const params = { params: Promise.resolve({ id }) };
    assert.equal((await getProductVideo(request, params)).status, 404);
    assert.equal((await deleteProductVideo(request, params)).status, 404);
    assert.equal((await productVideoJobs.get(id))?.id, id);

    const assetRequest = businessRequest(
      `http://localhost/api/product-videos/${id}/asset`,
      {},
      contextB,
    );
    assert.equal((await getProductVideoAsset(assetRequest, params)).status, 404);
  } finally {
    await productVideoJobs.delete(id);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { openMontageAssetUrl } from "../../src/lib/product-video/openmontage";

test("pins absolute adapter asset URLs to the configured private worker", () => {
  const previousUrl = process.env.OPENMONTAGE_WORKER_URL;
  process.env.OPENMONTAGE_WORKER_URL = "http://video-worker:8787";
  try {
    assert.equal(
      openMontageAssetUrl("https://untrusted.example/assets/job-1/video.mp4?download=1"),
      "http://video-worker:8787/assets/job-1/video.mp4?download=1",
    );
  } finally {
    if (previousUrl === undefined) delete process.env.OPENMONTAGE_WORKER_URL;
    else process.env.OPENMONTAGE_WORKER_URL = previousUrl;
  }
});

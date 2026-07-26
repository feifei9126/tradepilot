import assert from "node:assert/strict";
import test from "node:test";

import { POST as confirmFirecrawlImport } from "../../src/app/api/firecrawl/confirm/route";
import { GET as listProducts } from "../../src/app/api/products/route";
import { BusinessError } from "../../src/lib/business/errors";
import {
  firecrawlConfirmationSecret,
  signFirecrawlPreview,
  verifyFirecrawlPreview,
} from "../../src/lib/firecrawl/confirmation";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

const preview = {
  sourceUrl: "https://1.1.1.1/products/charger",
  name: "Portable Charger",
  modelNo: "PC-65",
  costPrice: 49.9,
  unit: "pcs",
  category: "Power",
  description: "65W portable charger",
  media: [
    {
      id: "volatile-id",
      type: "image" as const,
      url: "https://1.1.1.1/assets/charger.png",
      title: "Front",
      createdAt: "2026-07-26T00:00:00.000Z",
    },
  ],
};

function validationError(error: unknown) {
  return error instanceof BusinessError && error.code === "VALIDATION_ERROR";
}

test("signed Firecrawl previews verify within the confirmation window", async () => {
  const issuedAt = Date.parse("2026-07-26T00:00:00.000Z");
  const token = await signFirecrawlPreview(preview, "correct-secret", issuedAt);
  const normalized = await verifyFirecrawlPreview(
    preview,
    token,
    "correct-secret",
    issuedAt + 60_000,
  );
  assert.equal(normalized.name, "Portable Charger");
  assert.equal(normalized.media[0].url, preview.media[0].url);
});

test("Firecrawl confirmation rejects tampering, expiry and wrong secrets", async () => {
  const issuedAt = Date.parse("2026-07-26T00:00:00.000Z");
  const token = await signFirecrawlPreview(preview, "correct-secret", issuedAt);
  await assert.rejects(
    () =>
      verifyFirecrawlPreview(
        { ...preview, name: "Tampered Product" },
        token,
        "correct-secret",
        issuedAt + 60_000,
      ),
    validationError,
  );
  await assert.rejects(
    () =>
      verifyFirecrawlPreview(
        preview,
        token,
        "correct-secret",
        issuedAt + 15 * 60_000 + 1,
      ),
    validationError,
  );
  await assert.rejects(
    () =>
      verifyFirecrawlPreview(
        preview,
        token,
        "wrong-secret",
        issuedAt + 60_000,
      ),
    validationError,
  );
});

test("Firecrawl confirmation persists an untampered preview for the current tenant", async () => {
  const confirmationToken = await signFirecrawlPreview(
    preview,
    firecrawlConfirmationSecret(),
  );
  const response = await confirmFirecrawlImport(
    businessRequest(
      "http://localhost/api/firecrawl/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview, confirmationToken }),
      },
      contextA,
    ),
  );
  assert.equal(response.status, 201);

  const otherTenantResponse = await listProducts(
    businessRequest("http://localhost/api/products", {}, contextB),
  );
  const otherTenantProducts = (await otherTenantResponse.json()) as {
    name: string;
  }[];
  assert.equal(
    otherTenantProducts.some((product) => product.name === preview.name),
    false,
  );
});

test("Firecrawl confirmation rejects a missing confirmation token", async () => {
  const response = await confirmFirecrawlImport(
    businessRequest(
      "http://localhost/api/firecrawl/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview }),
      },
      contextA,
    ),
  );
  assert.equal(response.status, 400);
});

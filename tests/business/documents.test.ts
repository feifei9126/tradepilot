import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../../src/app/api/documents/download/route";
import { POST } from "../../src/app/api/documents/generate/route";
import { getBusinessRepository } from "../../src/lib/repositories";
import {
  businessRequest,
  demoBusinessContext,
} from "../helpers/business-context";
import { contextB } from "../repositories/contract";

test("document generation follows the selected type and is idempotent", async () => {
  const request = (type: string) =>
    businessRequest(
      "http://localhost/api/documents/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "o1", type }),
      },
      demoBusinessContext,
    );

  const existing = await POST(request("commercial_invoice"));
  const unsupported = await POST(request("msds"));

  assert.equal(existing.status, 200);
  assert.equal((await existing.json()).createdCount, 0);
  assert.equal(unsupported.status, 400);
});

test("draft document transitions to generated once and remains idempotent", async () => {
  const repository = await getBusinessRepository(demoBusinessContext);
  const request = () =>
    businessRequest(
      "http://localhost/api/documents/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "o2", type: "proforma_invoice" }),
      },
      demoBusinessContext,
    );

  const first = await POST(request());
  const second = await POST(request());
  const firstBody = await first.json();
  const secondBody = await second.json();

  assert.equal(first.status, 200);
  assert.equal(firstBody.createdCount, 1);
  assert.equal(second.status, 200);
  assert.equal(secondBody.createdCount, 0);
  assert.equal(
    (await repository.documents.listByOrder("o2")).filter(
      (document) => document.type === "proforma_invoice",
    ).length,
    1,
  );
});

test("document line items use the order currency", async () => {
  const repository = await getBusinessRepository(demoBusinessContext);
  const original = await repository.orders.get("o1");
  assert.ok(original);
  await repository.orders.update("o1", { currency: "EUR" });

  const response = await GET(
    businessRequest(
      "http://localhost/api/documents/download?id=d1",
      {},
      demoBusinessContext,
    ),
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /EUR 12\.50/);
  assert.doesNotMatch(html, /\$12\.50/);
  await repository.orders.update("o1", { currency: original.currency });
});

test("document download is hidden from another tenant", async () => {
  const response = await GET(
    businessRequest(
      "http://localhost/api/documents/download?id=d1",
      {},
      contextB,
    ),
  );
  assert.equal(response.status, 404);
});

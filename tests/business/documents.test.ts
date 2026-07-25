import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../../src/app/api/documents/download/route";
import { POST } from "../../src/app/api/documents/generate/route";
import { store } from "../../src/lib/store";

test("document generation follows the selected type and is idempotent", async () => {
  const request = (type: string) =>
    new Request("http://localhost/api/documents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "o1", type }),
    });

  const existing = await POST(request("commercial_invoice") as never);
  const unsupported = await POST(request("msds") as never);

  assert.equal(existing.status, 200);
  assert.equal((await existing.json()).createdCount, 0);
  assert.equal(unsupported.status, 400);
});

test("draft document transitions to generated once and remains idempotent", async () => {
  store.documents.update("d3", { status: "draft", createdAt: "2026-05-28" });
  const request = () =>
    new Request("http://localhost/api/documents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "o2", type: "proforma_invoice" }),
    });

  const first = await POST(request() as never);
  const second = await POST(request() as never);
  const firstBody = await first.json();
  const secondBody = await second.json();

  assert.equal(first.status, 200);
  assert.equal(firstBody.createdCount, 1);
  assert.equal(second.status, 200);
  assert.equal(secondBody.createdCount, 0);
  assert.equal(
    store.documents
      .byOrder("o2")
      .filter((document) => document.type === "proforma_invoice").length,
    1,
  );
  store.documents.update("d3", { status: "draft", createdAt: "2026-05-28" });
});

test("document line items use the order currency", async () => {
  const original = store.orders.get("o1");
  assert.ok(original);
  store.orders.update("o1", { currency: "EUR" });

  const response = await GET(
    new Request("http://localhost/api/documents/download?id=d1") as never,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /EUR 12\.50/);
  assert.doesNotMatch(html, /\$12\.50/);
  store.orders.update("o1", { currency: original.currency });
});

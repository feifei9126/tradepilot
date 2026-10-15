import assert from "node:assert/strict";
import { workspaceTest as test } from "../helpers/workspace";

import { PATCH, POST } from "../../src/app/api/shipments/route";

test("duplicate shipment creation is rejected", async () => {
  const response = await POST(
    new Request("http://localhost/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "o1",
        method: "sea",
        carrier: "Duplicate carrier",
        referenceNo: "DUPLICATE-001",
      }),
    }) as never,
  );

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /已有出货记录/);
});

test("shipment progress updates the related order status", async (_t, store) => {
  const originalShipment = await store.shipments.get("sh2");
  const originalOrder = await store.orders.get("o1");
  assert.ok(originalShipment);
  assert.ok(originalOrder);
  await store.shipments.update("sh2", { status: "booked" });

  const response = await PATCH(
    new Request("http://localhost/api/shipments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "sh2", status: "in_transit" }),
    }) as never,
  );

  assert.equal(response.status, 200);
  assert.equal((await store.shipments.get("sh2"))?.status, "in_transit");
  assert.equal((await store.orders.get("o1"))?.status, "shipped");
  assert.equal((await store.orders.get("o1"))?.progressPercent, 100);
  await store.shipments.update("sh2", { status: originalShipment.status });
  await store.orders.update("o1", {
    status: originalOrder.status,
    progressPercent: originalOrder.progressPercent,
  });
});

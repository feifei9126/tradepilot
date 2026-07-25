import assert from "node:assert/strict";
import test from "node:test";

import { store, type StoredShipment } from "../../src/lib/store";

test("quotation and order sequences continue after seeded records", () => {
  assert.equal(store.quotations.nextNo(), "QTN-2026-004");
  assert.equal(store.orders.nextNo(), "ORD-2026-091");
});

test("seeded quotation, order, and shipment states are consistent", () => {
  for (const order of store.orders.list()) {
    const quotation = order.quotationId
      ? store.quotations.get(order.quotationId)
      : undefined;
    if (!quotation) continue;
    assert.equal(quotation.status, "accepted");
    assert.equal(order.currency, quotation.currency);
    assert.equal(order.tradeTerm, quotation.tradeTerm);
  }

  for (const shipment of store.shipments.list()) {
    const order = store.orders.get(shipment.orderId);
    assert.ok(order);
    if (shipment.status === "delivered") {
      assert.equal(order.status, "completed");
    } else if (["departed", "in_transit"].includes(shipment.status)) {
      assert.equal(order.status, "shipped");
    }
  }
});

test("shipment records can be created and removed", () => {
  const shipment: StoredShipment = {
    id: "shipment-test",
    orderId: "o1",
    orderNo: "ORD-2026-088",
    customer: "BestBuy Co.",
    method: "sea",
    carrier: "Test Carrier",
    referenceNo: "TEST1234567",
    status: "booked",
    createdAt: new Date().toISOString(),
  };

  store.shipments.add(shipment);
  assert.equal(store.shipments.get(shipment.id)?.referenceNo, "TEST1234567");
  assert.equal(store.shipments.remove(shipment.id), true);
  assert.equal(store.shipments.get(shipment.id), undefined);
});

test("order communication updates are retained by the store", () => {
  const previous = store.orders.get("o1")?.comms || [];
  const communication = {
    from: "QA",
    date: "2026-07-23",
    channel: "内部记录",
    text: "流程审计记录",
  };
  const updated = store.orders.update("o1", {
    comms: [...previous, communication],
  });
  assert.equal(updated?.comms?.at(-1)?.text, "流程审计记录");
  store.orders.update("o1", { comms: previous });
});

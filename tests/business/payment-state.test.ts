import assert from "node:assert/strict";
import test from "node:test";
import { aggregateOrderPaymentStatus, reducePaymentStatus } from "../../src/lib/payments/state";

test("payment state transitions are monotonic", () => {
  assert.equal(reducePaymentStatus("paid", "pending"), "paid");
  assert.equal(reducePaymentStatus("pending", "requires_action"), "requires_action");
  assert.equal(aggregateOrderPaymentStatus(1000, 0, 0), "unpaid");
  assert.equal(aggregateOrderPaymentStatus(1000, 500, 0), "partial");
  assert.equal(aggregateOrderPaymentStatus(1000, 1000, 0), "paid");
  assert.equal(aggregateOrderPaymentStatus(1000, 1000, 200), "partially_refunded");
  assert.equal(aggregateOrderPaymentStatus(1000, 1000, 1000), "refunded");
});

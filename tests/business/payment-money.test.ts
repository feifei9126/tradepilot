import assert from "node:assert/strict";
import test from "node:test";
import { assertCollectable, fromMinorUnits, toMinorUnits } from "../../src/lib/payments/money";

test("money uses minor units and rejects over-collection", () => {
  assert.equal(toMinorUnits("12.30", "USD"), 1230);
  assert.equal(toMinorUnits("12", "JPY"), 12);
  assert.equal(fromMinorUnits(1230, "USD"), "12.30");
  assert.throws(() => toMinorUnits("12.3", "JPY"), /precision/i);
  assert.throws(() => toMinorUnits("-1", "USD"), /positive/i);
  assert.throws(() => assertCollectable({ paid: 900, pending: 200, total: 1000 }), /exceeds/i);
});

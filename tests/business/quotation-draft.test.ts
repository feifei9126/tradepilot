import assert from "node:assert/strict";
import test from "node:test";

import { buildCostBasedQuotationItems } from "../../src/lib/quotation-draft";

test("local quotation drafts apply markup and compute totals", () => {
  const items = buildCostBasedQuotationItems(
    [{ id: "p1", name: "Product", costPrice: 10, unit: "pcs" }],
    [{ productId: "p1", qty: 5 }],
  );

  assert.deepEqual(items, [
    {
      productId: "p1",
      productName: "Product",
      quantity: 5,
      unit: "pcs",
      unitPrice: 12,
      amount: 60,
    },
  ]);
});

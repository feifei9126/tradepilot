import assert from "node:assert/strict";
import test from "node:test";

import { buildFinanceData } from "../../src/lib/finance";
import type { StoredOrder, StoredQuotation } from "../../src/lib/store";

test("finance data is derived from orders without inventing payment records", () => {
  const quotations: StoredQuotation[] = [{
    id: "q1", no: "QTN-1", contactId: "c1", contactName: "Customer",
    items: [], totalAmount: 1200, currency: "EUR", tradeTerm: "FOB",
    status: "accepted", aiGenerated: false, createdAt: "2026-01-01",
  }];
  const orders: StoredOrder[] = [{
    id: "o1", no: "ORD-1", contactId: "c1", contactName: "Customer",
    quotationId: "q1", items: [], totalAmount: 1200, status: "confirmed",
    progressPercent: 20, createdAt: "2026-01-02",
  }];

  const result = buildFinanceData(orders, quotations);

  assert.equal(result.receivables[0].currency, "EUR");
  assert.equal(result.receivables[0].status, "untracked");
  assert.equal(result.receivables[0].paid, 0);
  assert.deepEqual(result.landedCosts, []);
  assert.deepEqual(result.taxRecords, []);
});

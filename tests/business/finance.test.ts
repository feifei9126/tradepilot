import assert from "node:assert/strict";
import test from "node:test";

import { GET as getFinance } from "../../src/app/api/finance/route";
import { buildFinanceData } from "../../src/lib/finance";
import { getBusinessRepository } from "../../src/lib/repositories";
import type { StoredOrder, StoredQuotation } from "../../src/lib/store";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

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

test("finance route returns only the current tenant's orders", async () => {
  const repository = await getBusinessRepository(contextA);
  const contact = await repository.contacts.create({ name: "Finance Customer" });
  const quotation = await repository.quotations.create({
    contactId: contact.id,
    items: [{ productName: "Finance Product", quantity: 3, unitPrice: 40 }],
    currency: "EUR",
    tradeTerm: "FOB",
    aiGenerated: false,
  });
  await repository.quotations.updateStatus(quotation.id, "accepted");
  await repository.orders.createFromQuotation({
    quotationId: quotation.id,
    deliveryDate: "2026-09-01",
  });

  const companyAResponse = await getFinance(
    businessRequest("http://localhost/api/finance", {}, contextA),
  );
  const companyBResponse = await getFinance(
    businessRequest("http://localhost/api/finance", {}, contextB),
  );
  const companyA = await companyAResponse.json();
  const companyB = await companyBResponse.json();
  assert.equal(companyA.receivables.length, 1);
  assert.equal(companyA.receivables[0].currency, "EUR");
  assert.deepEqual(companyB.receivables, []);
});

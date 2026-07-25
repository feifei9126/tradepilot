import assert from "node:assert/strict";
import test from "node:test";

import { PATCH } from "../../src/app/api/orders/[id]/route";
import { POST } from "../../src/app/api/orders/route";
import {
  store,
  type StoredContact,
  type StoredQuotation,
} from "../../src/lib/store";

test("an accepted quotation can create only one order", async () => {
  const contact: StoredContact = {
    id: "workflow-contact",
    name: "Workflow Customer",
    createdAt: "2026-07-23",
  };
  const quotation: StoredQuotation = {
    id: "workflow-quotation",
    no: "QTN-WORKFLOW",
    contactId: contact.id,
    contactName: contact.name,
    items: [
      {
        productName: "Test Product",
        quantity: 10,
        unit: "pcs",
        unitPrice: 12,
        amount: 120,
      },
    ],
    totalAmount: 120,
    currency: "USD",
    tradeTerm: "FOB",
    status: "accepted",
    aiGenerated: false,
    createdAt: "2026-07-23",
  };
  store.contacts.add(contact);
  store.quotations.add(quotation);

  const request = () =>
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quotationId: quotation.id,
        deliveryDate: "2026-08-01",
      }),
    });
  const created = await POST(request() as never);
  const duplicate = await POST(request() as never);

  assert.equal(created.status, 201);
  const createdOrder = await created.json();
  assert.equal(createdOrder.tradeTerm, "FOB");
  assert.equal(createdOrder.currency, quotation.currency);
  assert.equal(duplicate.status, 409);
  assert.match((await duplicate.json()).error, /已经创建过订单/);
  store.contacts.delete(contact.id);
});

test("order PATCH cannot overwrite identity or financial fields", async () => {
  const original = store.orders.get("o2");
  assert.ok(original);

  const response = await PATCH(
    new Request("http://localhost/api/orders/o2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        no: "ORD-TAMPERED",
        contactName: "Tampered customer",
        totalAmount: 1,
        items: [],
      }),
    }) as never,
    { params: Promise.resolve({ id: "o2" }) },
  );

  assert.equal(response.status, 400);
  const current = store.orders.get("o2");
  assert.equal(current?.no, original.no);
  assert.equal(current?.contactName, original.contactName);
  assert.equal(current?.totalAmount, original.totalAmount);
  assert.deepEqual(current?.items, original.items);
});

test("order status enforces its minimum workflow progress", async () => {
  const original = store.orders.get("o2");
  assert.ok(original);

  const response = await PATCH(
    new Request("http://localhost/api/orders/o2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inspection" }),
    }) as never,
    { params: Promise.resolve({ id: "o2" }) },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).progressPercent, 70);
  store.orders.update("o2", {
    status: original.status,
    progressPercent: original.progressPercent,
  });
});

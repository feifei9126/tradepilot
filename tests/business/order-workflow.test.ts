import assert from "node:assert/strict";
import test from "node:test";

import {
  GET,
  PATCH,
} from "../../src/app/api/orders/[id]/route";
import { POST } from "../../src/app/api/orders/route";
import { getBusinessRepository } from "../../src/lib/repositories";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

async function createAcceptedQuotation() {
  const repository = await getBusinessRepository(contextA);
  const contact = await repository.contacts.create({ name: "Order Customer" });
  const quotation = await repository.quotations.create({
    contactId: contact.id,
    items: [
      {
        productName: "Test Product",
        quantity: 10,
        unit: "pcs",
        unitPrice: 12,
      },
    ],
    currency: "USD",
    tradeTerm: "FOB",
    aiGenerated: false,
  });
  await repository.quotations.updateStatus(quotation.id, "accepted");
  return { repository, quotation };
}

async function createOrder() {
  const { repository, quotation } = await createAcceptedQuotation();
  const order = await repository.orders.createFromQuotation({
    quotationId: quotation.id,
    deliveryDate: "2026-08-01",
  });
  return { repository, order };
}

test("an accepted quotation can create only one order", async () => {
  const { quotation } = await createAcceptedQuotation();
  const request = () =>
    businessRequest(
      "http://localhost/api/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationId: quotation.id,
          deliveryDate: "2026-08-01",
        }),
      },
      contextA,
    );
  const created = await POST(request());
  const duplicate = await POST(request());

  assert.equal(created.status, 201);
  const createdOrder = await created.json();
  assert.equal(createdOrder.tradeTerm, "FOB");
  assert.equal(createdOrder.currency, quotation.currency);
  assert.equal(duplicate.status, 409);
  assert.match((await duplicate.json()).error, /已创建|已经创建/);
});

test("order PATCH cannot overwrite identity or financial fields", async () => {
  const { repository, order } = await createOrder();
  const response = await PATCH(
    businessRequest(
      `http://localhost/api/orders/${order.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          no: "ORD-TAMPERED",
          contactName: "Tampered customer",
          totalAmount: 1,
          items: [],
        }),
      },
      contextA,
    ),
    { params: Promise.resolve({ id: order.id }) },
  );

  assert.equal(response.status, 400);
  const current = await repository.orders.get(order.id);
  assert.equal(current?.no, order.no);
  assert.equal(current?.contactName, order.contactName);
  assert.equal(current?.totalAmount, order.totalAmount);
  assert.deepEqual(current?.items, order.items);
});

test("order status enforces its minimum workflow progress", async () => {
  const { order } = await createOrder();
  const response = await PATCH(
    businessRequest(
      `http://localhost/api/orders/${order.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inspection" }),
      },
      contextA,
    ),
    { params: Promise.resolve({ id: order.id }) },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).progressPercent, 70);
});

test("order detail is hidden from another tenant", async () => {
  const { order } = await createOrder();
  const response = await GET(
    businessRequest(`http://localhost/api/orders/${order.id}`, {}, contextB),
    { params: Promise.resolve({ id: order.id }) },
  );
  assert.equal(response.status, 404);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  GET as getQuotation,
  PATCH as updateQuotation,
} from "../../src/app/api/quotations/[id]/route";
import { GET as listQuotations } from "../../src/app/api/quotations/route";
import { getBusinessRepository } from "../../src/lib/repositories";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

async function createOrderedQuotation() {
  const repository = await getBusinessRepository(contextA);
  const contact = await repository.contacts.create({ name: "Workflow Customer" });
  const quotation = await repository.quotations.create({
    contactId: contact.id,
    items: [{ productName: "Workflow Product", quantity: 2, unitPrice: 10 }],
    currency: "USD",
    tradeTerm: "FOB",
    aiGenerated: false,
  });
  await repository.quotations.updateStatus(quotation.id, "accepted");
  const order = await repository.orders.createFromQuotation({
    quotationId: quotation.id,
    deliveryDate: "2026-09-01",
  });
  return { quotation, order };
}

test("quotation list exposes the order created from each quotation", async () => {
  const { quotation, order } = await createOrderedQuotation();
  const response = await listQuotations(
    businessRequest("http://localhost/api/quotations", {}, contextA),
  );
  assert.equal(response.status, 200);
  const quotations = await response.json();
  assert.equal(
    quotations.find((record: { id: string }) => record.id === quotation.id)
      ?.orderId,
    order.id,
  );
});

test("a quotation linked to an order cannot change status", async () => {
  const { quotation } = await createOrderedQuotation();
  const response = await updateQuotation(
    businessRequest(
      `http://localhost/api/quotations/${quotation.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      },
      contextA,
    ),
    { params: Promise.resolve({ id: quotation.id }) },
  );

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /不能再修改状态/);
});

test("quotation detail is hidden from another tenant", async () => {
  const { quotation } = await createOrderedQuotation();
  const response = await getQuotation(
    businessRequest(
      `http://localhost/api/quotations/${quotation.id}`,
      {},
      contextB,
    ),
    { params: Promise.resolve({ id: quotation.id }) },
  );
  assert.equal(response.status, 404);
});

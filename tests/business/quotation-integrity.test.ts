import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../src/app/api/quotations/route";
import { getBusinessRepository } from "../../src/lib/repositories";
import { businessRequest } from "../helpers/business-context";
import { contextA } from "../repositories/contract";

test("quotation totals are recomputed from quantity and unit price", async () => {
  const repository = await getBusinessRepository(contextA);
  const contact = await repository.contacts.create({ name: "Quote Customer" });
  const response = await POST(
    businessRequest(
      "http://localhost/api/quotations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          currency: "USD",
          tradeTerm: "FOB",
          totalAmount: 1,
          items: [
            {
              productName: "Integrity product",
              quantity: 3,
              unit: "pcs",
              unitPrice: 12.34,
              amount: 1,
            },
            {
              productName: "Second product",
              quantity: 2,
              unit: "pcs",
              unitPrice: 5,
              amount: 999,
            },
          ],
        }),
      },
      contextA,
    ),
  );

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.items[0].amount, 37.02);
  assert.equal(body.items[1].amount, 10);
  assert.equal(body.totalAmount, 47.02);
});

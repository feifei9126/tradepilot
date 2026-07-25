import assert from "node:assert/strict";
import test from "node:test";

import { GET as listQuotations } from "../../src/app/api/quotations/route";
import { PATCH as updateQuotation } from "../../src/app/api/quotations/[id]/route";

test("quotation list exposes the order created from each quotation", async () => {
  const response = await listQuotations();
  assert.equal(response.status, 200);
  const quotations = await response.json();
  assert.equal(
    quotations.find((quotation: { id: string }) => quotation.id === "q1")
      ?.orderId,
    "o1",
  );
});

test("a quotation linked to an order cannot change status", async () => {
  const response = await updateQuotation(
    new Request("http://localhost/api/quotations/q1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    }) as never,
    { params: Promise.resolve({ id: "q1" }) },
  );

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /不能再修改状态/);
});

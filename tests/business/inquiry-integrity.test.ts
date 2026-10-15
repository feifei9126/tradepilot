import assert from "node:assert/strict";
import { workspaceTest as test } from "../helpers/workspace";

import { PATCH } from "../../src/app/api/inquiries/[id]/route";

test("inquiry PATCH cannot overwrite customer or inquiry content", async (_t, store) => {
  const original = await store.inquiries.get("i1");
  assert.ok(original);

  const response = await PATCH(
    new Request("http://localhost/api/inquiries/i1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: "Tampered customer",
        subject: "Tampered subject",
        content: "Tampered content",
      }),
    }) as never,
    { params: Promise.resolve({ id: "i1" }) },
  );

  assert.equal(response.status, 400);
  const current = await store.inquiries.get("i1");
  assert.equal(current?.customer, original.customer);
  assert.equal(current?.subject, original.subject);
  assert.equal(current?.content, original.content);
});

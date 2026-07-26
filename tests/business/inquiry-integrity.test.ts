import assert from "node:assert/strict";
import test from "node:test";

import {
  GET,
  PATCH,
} from "../../src/app/api/inquiries/[id]/route";
import { POST as createInquiry } from "../../src/app/api/inquiries/route";
import { getBusinessRepository } from "../../src/lib/repositories";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

test("inquiry PATCH cannot overwrite customer or inquiry content", async () => {
  const repository = await getBusinessRepository(contextA);
  const inquiry = await repository.inquiries.create({
    customer: "Integrity Customer",
    subject: "Original subject",
    content: "Original content",
    source: "email",
  });

  const response = await PATCH(
    businessRequest(
      `http://localhost/api/inquiries/${inquiry.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: "Tampered customer",
          subject: "Tampered subject",
          content: "Tampered content",
        }),
      },
      contextA,
    ),
    { params: Promise.resolve({ id: inquiry.id }) },
  );

  assert.equal(response.status, 400);
  const current = await repository.inquiries.get(inquiry.id);
  assert.equal(current?.customer, inquiry.customer);
  assert.equal(current?.subject, inquiry.subject);
  assert.equal(current?.content, inquiry.content);
});

test("inquiry detail is hidden from another tenant", async () => {
  const createdResponse = await createInquiry(
    businessRequest(
      "http://localhost/api/inquiries",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: "Tenant A Customer",
          subject: "Tenant A subject",
          content: "Tenant A content",
          source: "manual",
        }),
      },
      contextA,
    ),
  );
  assert.equal(createdResponse.status, 201);
  const inquiry = (await createdResponse.json()) as { id: string };
  const response = await GET(
    businessRequest(
      `http://localhost/api/inquiries/${inquiry.id}`,
      {},
      contextB,
    ),
    { params: Promise.resolve({ id: inquiry.id }) },
  );
  assert.equal(response.status, 404);
});

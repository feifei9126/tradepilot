import assert from "node:assert/strict";

import type { BusinessContext } from "../../src/lib/business/context";
import { BusinessError } from "../../src/lib/business/errors";
import type { RepositoryFactory } from "../../src/lib/repositories/contracts";

const contextA: BusinessContext = {
  userId: "10000000-0000-4000-8000-000000000001",
  companyId: "10000000-0000-4000-8000-000000000002",
  role: "owner",
};

const contextB: BusinessContext = {
  userId: "20000000-0000-4000-8000-000000000001",
  companyId: "20000000-0000-4000-8000-000000000002",
  role: "owner",
};

export async function runRepositoryContract(createRepository: RepositoryFactory) {
  const companyA = await createRepository(contextA);
  const companyB = await createRepository(contextB);

  const contact = await companyA.contacts.create({
    name: "Contract Customer",
    country: "US",
    email: "buyer@example.com",
    phone: "+1 555 0100",
    source: "manual",
    tags: ["contract"],
    grade: "A",
    stage: "new",
  });
  assert.equal((await companyA.contacts.get(contact.id))?.name, contact.name);
  assert.equal(await companyB.contacts.get(contact.id), null);

  const product = await companyA.products.create({
    name: "Contract Product",
    unit: "pcs",
    costPrice: 5,
    moq: 10,
  });
  assert.equal((await companyA.products.get(product.id))?.costPrice, 5);
  assert.equal(await companyB.products.get(product.id), null);

  const inquiry = await companyA.inquiries.create({
    customer: contact.name,
    contactId: contact.id,
    subject: "Need a quotation",
    content: "Please quote 20 pieces.",
    source: "email",
  });
  assert.equal((await companyA.inquiries.get(inquiry.id))?.status, "pending");
  assert.equal(await companyB.inquiries.get(inquiry.id), null);

  const quotation = await companyA.quotations.create({
    contactId: contact.id,
    items: [
      {
        productId: product.id,
        productName: product.name,
        quantity: 20,
        unit: "pcs",
        unitPrice: 9,
        amount: 1,
      },
    ],
    currency: "USD",
    tradeTerm: "FOB",
    aiGenerated: false,
  });
  assert.equal(quotation.totalAmount, 180);
  assert.match(quotation.no, /^QTN-\d{4}-\d{3}$/);
  assert.equal(await companyB.quotations.get(quotation.id), null);

  await companyA.quotations.updateStatus(quotation.id, "accepted");
  const order = await companyA.orders.createFromQuotation({
    quotationId: quotation.id,
    deliveryDate: "2026-09-01",
  });
  assert.equal(order.totalAmount, quotation.totalAmount);
  assert.match(order.no, /^ORD-\d{4}-\d{3}$/);
  assert.equal(await companyB.orders.get(order.id), null);

  const shipment = await companyA.shipments.create({
    orderId: order.id,
    method: "sea",
    carrier: "Carrier",
    referenceNo: "REF-001",
    etd: "2026-08-01",
    eta: "2026-08-20",
  });
  const delivered = await companyA.shipments.advanceStatus(
    shipment.id,
    "delivered",
  );
  assert.equal(delivered.status, "delivered");
  assert.equal((await companyA.orders.get(order.id))?.status, "completed");
  assert.equal(await companyB.shipments.get(shipment.id), null);

  const firstDocuments = await companyA.documents.generateForOrder(order.id, [
    "commercial_invoice",
  ]);
  const secondDocuments = await companyA.documents.generateForOrder(order.id, [
    "commercial_invoice",
  ]);
  assert.equal(firstDocuments.length, 1);
  assert.equal(secondDocuments[0].id, firstDocuments[0].id);
  assert.equal(await companyB.documents.get(firstDocuments[0].id), null);

  await assert.rejects(
    () => companyA.contacts.removeIfUnreferenced(contact.id),
    (error: unknown) =>
      error instanceof BusinessError && error.code === "CONFLICT",
  );

  const snapshot = await companyA.dashboard.snapshot();
  assert.equal(snapshot.contacts.length, 1);
  assert.equal(snapshot.products.length, 1);
  assert.equal(snapshot.inquiries.length, 1);
  assert.equal(snapshot.quotations.length, 1);
  assert.equal(snapshot.orders.length, 1);

  const otherSnapshot = await companyB.dashboard.snapshot();
  assert.deepEqual(otherSnapshot, {
    contacts: [],
    products: [],
    inquiries: [],
    quotations: [],
    orders: [],
  });
}

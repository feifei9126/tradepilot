import assert from "node:assert/strict";
import test from "node:test";

import { BusinessError } from "../../src/lib/business/errors";
import {
  decimalNumber,
  isoDate,
  isoTimestamp,
  lineItems,
  mapContact,
  mapDocument,
  mapInquiry,
  mapOrder,
  mapProduct,
  mapQuotation,
  mapShipment,
  throwRepositoryError,
} from "../../src/lib/repositories/postgres/mappers";

function asRow<T>(value: Record<string, unknown>) {
  return value as unknown as T;
}

function schemaError(error: unknown) {
  return (
    error instanceof BusinessError && error.code === "DATABASE_SCHEMA_OUTDATED"
  );
}

test("database scalar mappers reject corrupt values and normalize valid dates", () => {
  assert.equal(decimalNumber(null), 0);
  assert.equal(decimalNumber("12.50"), 12.5);
  assert.throws(() => decimalNumber("not-a-number"), schemaError);

  assert.equal(isoDate(undefined), undefined);
  assert.equal(isoDate(new Date("2026-07-26T12:34:56.000Z")), "2026-07-26");
  assert.equal(isoDate("2026-07-27T00:00:00.000Z"), "2026-07-27");
  assert.throws(() => isoDate("not-a-date"), schemaError);

  assert.equal(isoTimestamp(null), undefined);
  assert.equal(
    isoTimestamp(new Date("2026-07-26T12:34:56.000Z")),
    "2026-07-26T12:34:56.000Z",
  );
  assert.equal(
    isoTimestamp("2026-07-27T00:00:00.000Z"),
    "2026-07-27T00:00:00.000Z",
  );
  assert.throws(() => isoTimestamp("not-a-timestamp"), schemaError);
});

test("line item mapping validates JSON shape and optional money fields", () => {
  assert.throws(() => lineItems(null), schemaError);
  assert.throws(() => lineItems([null]), schemaError);
  assert.throws(
    () => lineItems([{ productName: 42, quantity: 1 }]),
    schemaError,
  );
  assert.throws(
    () => lineItems([{ productName: "Invalid quantity", quantity: "many" }]),
    schemaError,
  );

  assert.deepEqual(
    lineItems([
      {
        productId: "product-1",
        productName: "Full item",
        quantity: "2",
        unit: "pcs",
        unitPrice: "3.25",
        amount: 6.5,
      },
      { productName: "Minimal item", quantity: 1 },
    ]),
    [
      {
        productId: "product-1",
        productName: "Full item",
        quantity: 2,
        unit: "pcs",
        unitPrice: 3.25,
        amount: 6.5,
      },
      {
        productId: undefined,
        productName: "Minimal item",
        quantity: 1,
        unit: undefined,
        unitPrice: undefined,
        amount: undefined,
      },
    ],
  );
});

test("product mapping filters malformed media and applies field defaults", () => {
  const minimal = mapProduct(
    asRow<Parameters<typeof mapProduct>[0]>({
      id: "product-minimal",
      name: "Minimal",
      modelNo: null,
      hsCode: null,
      costPrice: null,
      unit: null,
      moq: null,
      category: null,
      description: null,
      stockQuantity: null,
      lowStockThreshold: null,
      warehouse: null,
      source: null,
      media: "invalid",
    }),
  );
  assert.equal(minimal.unit, "pcs");
  assert.equal(minimal.costPrice, 0);
  assert.equal(minimal.stockQuantity, 0);
  assert.deepEqual(minimal.media, []);

  const complete = mapProduct(
    asRow<Parameters<typeof mapProduct>[0]>({
      id: "product-complete",
      name: "Complete",
      modelNo: "MODEL-1",
      hsCode: "1234",
      costPrice: "8.5",
      unit: "set",
      moq: 10,
      category: "Audio",
      description: "Description",
      stockQuantity: 5,
      lowStockThreshold: 2,
      warehouse: "A1",
      source: "manual",
      media: [
        null,
        1,
        { type: "image", url: "https://example.com/a.png", createdAt: "now" },
        { id: "bad-type", type: "pdf", url: "https://example.com/a", createdAt: "now" },
        { id: "no-url", type: "image", createdAt: "now" },
        { id: "no-date", type: "image", url: "https://example.com/a.png" },
        {
          id: "image-1",
          type: "image",
          url: "https://example.com/a.png",
          createdAt: "2026-07-26T00:00:00.000Z",
        },
        {
          id: "video-1",
          type: "video",
          url: "https://example.com/a.mp4",
          sourceUrl: "https://example.com/product",
          title: "Demo",
          mimeType: "video/mp4",
          createdAt: "2026-07-26T00:00:00.000Z",
        },
      ],
    }),
  );
  assert.equal(complete.modelNo, "MODEL-1");
  const media = complete.media;
  assert.ok(media);
  assert.equal(media.length, 2);
  assert.equal(media[0].sourceUrl, undefined);
  assert.equal(media[1].mimeType, "video/mp4");
});

test("contact mapping selects a primary person and normalizes activity fallbacks", () => {
  const baseContact = {
    id: "contact-1",
    name: "Buyer",
    country: null,
    source: null,
    tags: null,
    notes: null,
    grade: "invalid",
    stage: null,
    lastContactedAt: null,
    nextFollowUpAt: null,
    createdAt: "2026-07-26T00:00:00.000Z",
  };
  const fallback = mapContact(
    asRow<Parameters<typeof mapContact>[0]>(baseContact),
    [
      asRow<NonNullable<Parameters<typeof mapContact>[1]>[number]>({
        name: "First",
        position: null,
        phone: "+1",
        email: "first@example.com",
        isPrimary: false,
      }),
      asRow<NonNullable<Parameters<typeof mapContact>[1]>[number]>({
        name: "Second",
        position: "Buyer",
        phone: null,
        email: null,
        isPrimary: false,
      }),
    ],
    [
      asRow<NonNullable<Parameters<typeof mapContact>[2]>[number]>({
        occurredAt: "2026-07-25T00:00:00.000Z",
        channel: "email",
        rawContent: "Raw content",
        subject: "Subject",
      }),
      asRow<NonNullable<Parameters<typeof mapContact>[2]>[number]>({
        occurredAt: "2026-07-24T00:00:00.000Z",
        channel: "call",
        rawContent: null,
        subject: "Subject only",
      }),
      asRow<NonNullable<Parameters<typeof mapContact>[2]>[number]>({
        occurredAt: null,
        channel: "note",
        rawContent: null,
        subject: null,
      }),
    ],
  );
  assert.equal(fallback.email, "first@example.com");
  assert.equal(fallback.grade, undefined);
  assert.deepEqual(
    fallback.activities?.map((activity) => activity.note),
    ["Raw content", "Subject only", ""],
  );

  for (const grade of ["A", "B", "C"] as const) {
    const mapped = mapContact(
      asRow<Parameters<typeof mapContact>[0]>({
        ...baseContact,
        country: "US",
        source: "manual",
        tags: ["vip"],
        notes: "Notes",
        grade,
        stage: "active",
        lastContactedAt: "2026-07-25T00:00:00.000Z",
        nextFollowUpAt: "2026-07-30T00:00:00.000Z",
      }),
      [
        asRow<NonNullable<Parameters<typeof mapContact>[1]>[number]>({
          name: "Primary",
          position: "Director",
          phone: "+2",
          email: "primary@example.com",
          isPrimary: true,
        }),
      ],
    );
    assert.equal(mapped.grade, grade);
    assert.equal(mapped.email, "primary@example.com");
  }
});

test("sales entity mappers normalize enum and JSON fallbacks", () => {
  const inquiryBase = {
    id: "inquiry-1",
    customerName: "Buyer",
    contactId: null,
    subject: null,
    rawText: null,
    source: null,
    aiReply: null,
    createdAt: null,
  };
  for (const [input, expected] of [
    ["quoted", "quoted"],
    ["converted", "converted"],
    ["lost", "lost"],
    ["unknown", "pending"],
  ]) {
    const inquiry = mapInquiry(
      asRow<Parameters<typeof mapInquiry>[0]>({
        ...inquiryBase,
        status: input,
      }),
    );
    assert.equal(inquiry.status, expected);
  }

  const quotation = mapQuotation(
    asRow<Parameters<typeof mapQuotation>[0]>({
      id: "quotation-1",
      quotationNo: "QTN-2026-001",
      contactId: "contact-1",
      itemsJson: [{ productName: "Item", quantity: 1 }],
      totalAmount: null,
      currency: null,
      tradeTerm: null,
      status: null,
      aiGenerated: null,
      createdAt: null,
    }),
    "Buyer",
  );
  assert.equal(quotation.currency, "USD");
  assert.equal(quotation.orderId, null);

  const order = mapOrder(
    asRow<Parameters<typeof mapOrder>[0]>({
      id: "order-1",
      orderNo: "ORD-2026-001",
      contactId: "contact-1",
      quotationId: null,
      itemsJson: [{ productName: "Item", quantity: 1 }],
      totalAmount: "10",
      currency: null,
      status: null,
      deliveryDate: null,
      progressPercent: null,
      tradeTerm: null,
      commsJson: [
        null,
        1,
        { date: "2026-07-26", channel: "email", text: "Missing from" },
        { from: "Buyer", channel: "email", text: "Missing date" },
        { from: "Buyer", date: "2026-07-26", text: "Missing channel" },
        { from: "Buyer", date: "2026-07-26", channel: "email" },
        {
          from: "Buyer",
          date: "2026-07-26",
          channel: "email",
          text: "Valid",
        },
      ],
      createdAt: null,
    }),
    "Buyer",
  );
  assert.equal(order.status, "confirmed");
  assert.equal(order.progressPercent, 0);
  assert.deepEqual(order.comms, [
    {
      from: "Buyer",
      date: "2026-07-26",
      channel: "email",
      text: "Valid",
    },
  ]);

  const noCommunications = mapOrder(
    asRow<Parameters<typeof mapOrder>[0]>({
      id: "order-2",
      orderNo: "ORD-2026-002",
      contactId: "contact-1",
      quotationId: "quotation-1",
      itemsJson: [],
      totalAmount: 0,
      currency: "EUR",
      status: "shipped",
      deliveryDate: "2026-08-01",
      progressPercent: 100,
      tradeTerm: "FOB",
      commsJson: null,
      createdAt: "2026-07-26",
    }),
    "Buyer",
  );
  assert.deepEqual(noCommunications.comms, []);
});

test("shipment and document mappers constrain storage enums", () => {
  const shipmentBase = {
    id: "shipment-1",
    orderId: "order-1",
    carrier: null,
    referenceNo: null,
    etd: null,
    eta: null,
    createdAt: null,
  };
  for (const [method, status, expectedMethod, expectedStatus] of [
    ["air", "departed", "air", "departed"],
    ["express", "in_transit", "express", "in_transit"],
    ["rail", "delivered", "sea", "delivered"],
    [null, "unknown", "sea", "booked"],
  ]) {
    const shipment = mapShipment(
      asRow<Parameters<typeof mapShipment>[0]>({
        ...shipmentBase,
        method,
        status,
      }),
      "ORD-2026-001",
      "Buyer",
    );
    assert.equal(shipment.method, expectedMethod);
    assert.equal(shipment.status, expectedStatus);
  }

  const generated = mapDocument(
    asRow<Parameters<typeof mapDocument>[0]>({
      id: "document-1",
      orderId: "order-1",
      docType: "commercial_invoice",
      status: "generated",
      createdAt: "2026-07-26",
      content: "Invoice",
    }),
    "ORD-2026-001",
  );
  const draft = mapDocument(
    asRow<Parameters<typeof mapDocument>[0]>({
      id: "document-2",
      orderId: "order-1",
      docType: "packing_list",
      status: "unknown",
      createdAt: null,
      content: null,
    }),
    "ORD-2026-001",
  );
  assert.equal(generated.status, "generated");
  assert.equal(generated.content, "Invoice");
  assert.equal(draft.status, "draft");
  assert.equal(draft.content, undefined);
});

test("repository errors preserve domain failures and classify database causes", () => {
  const domainError = new BusinessError("NOT_FOUND", "missing", 404);
  assert.throws(() => throwRepositoryError(domainError), (error) => error === domainError);
  assert.throws(
    () => throwRepositoryError({ code: "23505" }),
    (error: unknown) =>
      error instanceof BusinessError &&
      error.code === "CONFLICT" &&
      error.status === 409,
  );
  assert.throws(
    () => throwRepositoryError({ cause: { code: "23503" } }),
    (error: unknown) =>
      error instanceof BusinessError && error.code === "CONFLICT",
  );
  for (const cause of ["network failure", {}, { cause: null }]) {
    assert.throws(
      () => throwRepositoryError(cause),
      (error: unknown) =>
        error instanceof BusinessError &&
        error.code === "DATABASE_UNAVAILABLE" &&
        error.status === 503,
    );
  }
});

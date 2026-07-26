import assert from "node:assert/strict";
import test from "node:test";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../../src/db/schema";
import { BusinessError } from "../../src/lib/business/errors";
import { createPostgresRepository } from "../../src/lib/repositories/postgres";
import { withCleanDatabase } from "../helpers/database";
import { contextA, contextB } from "./contract";

const databaseUrl = process.env.TRADEPILOT_TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("TRADEPILOT_TEST_DATABASE_URL is required for workflow tests");
}

function conflict(error: unknown) {
  return error instanceof BusinessError && error.code === "CONFLICT";
}

test("sales workflow allocates concurrent tenant-local numbers atomically", async () => {
  await withCleanDatabase(databaseUrl, async ({ databaseUrl, sql, migrate }) => {
    await migrate();
    await sql`
      INSERT INTO companies (id, name, slug)
      VALUES
        (${contextA.companyId}, 'Company A', 'workflow-company-a'),
        (${contextB.companyId}, 'Company B', 'workflow-company-b')
    `;

    const pool = postgres(databaseUrl, { max: 10, prepare: false });
    try {
      const db = drizzle(pool, { schema });
      const companyA = createPostgresRepository(db, contextA);
      const companyB = createPostgresRepository(db, contextB);
      const contact = await companyA.contacts.create({
        name: "Concurrent Buyer",
        source: "test",
      });
      const product = await companyA.products.create({
        name: "Concurrent Product",
        unit: "pcs",
        costPrice: 3,
      });

      const quotationInput = {
        contactId: contact.id,
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 10,
            unit: "pcs",
            unitPrice: 8,
          },
        ],
        currency: "USD",
        tradeTerm: "FOB",
        aiGenerated: false,
      };
      const created = await Promise.all(
        Array.from({ length: 20 }, () =>
          companyA.quotations.create(quotationInput),
        ),
      );
      assert.equal(new Set(created.map((item) => item.no)).size, 20);

      const otherContact = await companyB.contacts.create({
        name: "Other Tenant Buyer",
        source: "test",
      });
      const otherQuotation = await companyB.quotations.create({
        ...quotationInput,
        contactId: otherContact.id,
      });
      assert.match(otherQuotation.no, /-001$/);

      await assert.rejects(
        () =>
          companyB.quotations.create({
            ...quotationInput,
            contactId: contact.id,
          }),
        (error: unknown) =>
          error instanceof BusinessError && error.code === "NOT_FOUND",
      );

      const accepted = await companyA.quotations.updateStatus(
        created[0].id,
        "accepted",
      );
      const order = await companyA.orders.createFromQuotation({
        quotationId: accepted.id,
        deliveryDate: "2026-09-01",
      });
      await assert.rejects(
        () =>
          companyA.orders.createFromQuotation({
            quotationId: accepted.id,
            deliveryDate: "2026-09-01",
          }),
        conflict,
      );
      await assert.rejects(
        () => companyA.quotations.updateStatus(accepted.id, "rejected"),
        conflict,
      );

      const updatedOrder = await companyA.orders.update(order.id, {
        status: "in_production",
        progressPercent: 1,
        comms: [
          {
            from: "Buyer",
            date: "2026-07-26",
            channel: "email",
            text: "Production confirmed",
          },
        ],
      });
      assert.equal(updatedOrder?.progressPercent, 30);
      assert.equal(updatedOrder?.comms?.[0]?.channel, "email");

      const shipment = await companyA.shipments.create({
        orderId: order.id,
        method: "sea",
        carrier: "Concurrent Carrier",
        referenceNo: "SHIP-001",
        etd: "2026-08-20",
        eta: "2026-09-01",
      });
      await assert.rejects(
        () =>
          companyA.shipments.create({
            orderId: order.id,
            method: "air",
            carrier: "Duplicate Carrier",
            referenceNo: "SHIP-002",
          }),
        conflict,
      );
      const inTransit = await companyA.shipments.advanceStatus(
        shipment.id,
        "in_transit",
      );
      assert.equal(inTransit.status, "in_transit");
      assert.equal((await companyA.orders.get(order.id))?.status, "shipped");
      await assert.rejects(
        () => companyA.shipments.advanceStatus(shipment.id, "departed"),
        conflict,
      );
      const delivered = await companyA.shipments.advanceStatus(
        shipment.id,
        "delivered",
      );
      assert.equal(delivered.status, "delivered");
      assert.equal((await companyA.orders.get(order.id))?.status, "completed");

      const firstDocuments = await companyA.documents.generateForOrder(
        order.id,
        ["commercial_invoice", "packing_list"],
      );
      assert.equal(firstDocuments.length, 2);
      assert.match(firstDocuments[0].content || "", /ORD-/);
      const originalContent = firstDocuments[0].content;
      await companyA.orders.update(order.id, { deliveryDate: "2026-09-15" });
      const regenerated = await companyA.documents.generateForOrder(order.id, [
        "commercial_invoice",
      ]);
      assert.equal(regenerated[0].id, firstDocuments[0].id);
      assert.equal(regenerated[0].content, originalContent);
      assert.equal((await companyA.documents.listByOrder(order.id)).length, 2);

      const inquiry = await companyA.inquiries.create({
        customer: "Unlinked Buyer",
        subject: "General inquiry",
        content: "Please send a catalogue.",
        source: "website",
      });
      const replied = await companyA.inquiries.update(inquiry.id, {
        status: "quoted",
        aiReply: "Catalogue attached.",
      });
      assert.equal(replied?.aiReply, "Catalogue attached.");
    } finally {
      await pool.end({ timeout: 5 });
    }
  });
});

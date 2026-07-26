import assert from "node:assert/strict";
import test from "node:test";

import { GET as getDashboard } from "../../src/app/api/dashboard/route";
import { GET as downloadDocument } from "../../src/app/api/documents/download/route";
import { POST as generateDocuments } from "../../src/app/api/documents/generate/route";
import { GET as getFinance } from "../../src/app/api/finance/route";
import { GET as getLogistics } from "../../src/app/api/logistics/route";
import { POST as createOrder } from "../../src/app/api/orders/route";
import {
  PATCH as updateQuotation,
} from "../../src/app/api/quotations/[id]/route";
import { POST as createQuotation } from "../../src/app/api/quotations/route";
import {
  PATCH as updateShipment,
  POST as createShipment,
} from "../../src/app/api/shipments/route";
import { closeDb } from "../../src/db";
import { getBusinessRepository } from "../../src/lib/repositories";
import { businessRequest } from "../helpers/business-context";
import { withCleanDatabase } from "../helpers/database";
import { contextA, contextB } from "../repositories/contract";

const databaseUrl = process.env.TRADEPILOT_TEST_DATABASE_URL;
const databaseTest = databaseUrl ? test : test.skip;

function jsonRequest(
  path: string,
  body: unknown,
  context = contextA,
) {
  return businessRequest(
    `http://localhost${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    context,
  );
}

databaseTest("core sales routes persist through PostgreSQL with tenant isolation", async () => {
  await withCleanDatabase(databaseUrl!, async ({ databaseUrl, sql, migrate }) => {
    await migrate();
    await sql`
      INSERT INTO companies (id, name, slug)
      VALUES
        (${contextA.companyId}, 'Route Company A', 'route-company-a'),
        (${contextB.companyId}, 'Route Company B', 'route-company-b')
    `;

    const previousDatabaseUrl = process.env.DATABASE_URL;
    await closeDb();
    process.env.DATABASE_URL = databaseUrl;
    try {
      const repository = await getBusinessRepository(contextA);
      const contact = await repository.contacts.create({
        name: "PostgreSQL Route Customer",
      });

      const quotationResponse = await createQuotation(
        jsonRequest("/api/quotations", {
          contactId: contact.id,
          items: [
            {
              productName: "PostgreSQL Route Product",
              quantity: 5,
              unit: "pcs",
              unitPrice: 20,
            },
          ],
          currency: "USD",
          tradeTerm: "FOB",
        }),
      );
      assert.equal(quotationResponse.status, 201);
      const quotation = (await quotationResponse.json()) as { id: string };
      assert.equal(
        (
          await updateQuotation(
            businessRequest(
              `http://localhost/api/quotations/${quotation.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "accepted" }),
              },
              contextA,
            ),
            { params: Promise.resolve({ id: quotation.id }) },
          )
        ).status,
        200,
      );

      const orderResponse = await createOrder(
        jsonRequest("/api/orders", {
          quotationId: quotation.id,
          deliveryDate: "2026-09-01",
        }),
      );
      assert.equal(orderResponse.status, 201);
      const order = (await orderResponse.json()) as { id: string };

      const shipmentResponse = await createShipment(
        jsonRequest("/api/shipments", {
          orderId: order.id,
          method: "sea",
          carrier: "PostgreSQL Carrier",
          referenceNo: "PG-ROUTE-001",
          etd: "2026-08-01",
          eta: "2026-08-20",
        }),
      );
      assert.equal(shipmentResponse.status, 201);
      const shipment = (await shipmentResponse.json()) as { id: string };
      const shipmentUpdate = await updateShipment(
        businessRequest(
          "http://localhost/api/shipments",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: shipment.id, status: "in_transit" }),
          },
          contextA,
        ),
      );
      assert.equal(shipmentUpdate.status, 200);

      const documentResponse = await generateDocuments(
        jsonRequest("/api/documents/generate", {
          orderId: order.id,
          type: "commercial_invoice",
        }),
      );
      assert.equal(documentResponse.status, 200);
      const documents = (await documentResponse.json()) as {
        documents: { id: string }[];
      };
      const documentResponseB = await downloadDocument(
        businessRequest(
          `http://localhost/api/documents/download?id=${documents.documents[0].id}`,
          {},
          contextB,
        ),
      );
      assert.equal(documentResponseB.status, 404);

      const [dashboard, finance, logistics] = await Promise.all([
        getDashboard(businessRequest("http://localhost/api/dashboard", {}, contextA)),
        getFinance(businessRequest("http://localhost/api/finance", {}, contextA)),
        getLogistics(businessRequest("http://localhost/api/logistics", {}, contextA)),
      ]);
      assert.equal((await dashboard.json()).summary.revenue, 100);
      assert.equal((await finance.json()).receivables.length, 1);
      assert.equal((await logistics.json()).length, 1);
    } finally {
      await closeDb();
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});

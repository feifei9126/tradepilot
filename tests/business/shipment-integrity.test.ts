import assert from "node:assert/strict";
import test from "node:test";

import { GET as listLogistics } from "../../src/app/api/logistics/route";
import { PATCH, POST } from "../../src/app/api/shipments/route";
import { getBusinessRepository } from "../../src/lib/repositories";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

async function createOrderWithShipment() {
  const repository = await getBusinessRepository(contextA);
  const contact = await repository.contacts.create({ name: "Shipment Customer" });
  const quotation = await repository.quotations.create({
    contactId: contact.id,
    items: [{ productName: "Shipment Product", quantity: 4, unitPrice: 25 }],
    currency: "USD",
    tradeTerm: "FOB",
    aiGenerated: false,
  });
  await repository.quotations.updateStatus(quotation.id, "accepted");
  const order = await repository.orders.createFromQuotation({
    quotationId: quotation.id,
    deliveryDate: "2026-09-01",
  });
  const shipment = await repository.shipments.create({
    orderId: order.id,
    method: "sea",
    carrier: "Test Carrier",
    referenceNo: `REF-${order.id}`,
    etd: "2026-08-01",
    eta: "2026-08-20",
  });
  return { repository, order, shipment };
}

test("duplicate shipment creation is rejected", async () => {
  const { order } = await createOrderWithShipment();
  const response = await POST(
    businessRequest(
      "http://localhost/api/shipments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          method: "sea",
          carrier: "Duplicate carrier",
          referenceNo: "DUPLICATE-001",
          etd: "2026-08-01",
          eta: "2026-08-20",
        }),
      },
      contextA,
    ),
  );

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /已有物流|已有出货/);
});

test("shipment progress updates the related order status", async () => {
  const { repository, order, shipment } = await createOrderWithShipment();
  const response = await PATCH(
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

  assert.equal(response.status, 200);
  assert.equal((await repository.shipments.get(shipment.id))?.status, "in_transit");
  assert.equal((await repository.orders.get(order.id))?.status, "shipped");
  assert.equal((await repository.orders.get(order.id))?.progressPercent, 100);
});

test("shipment progress rejects a cancelled order", async () => {
  const { repository, order, shipment } = await createOrderWithShipment();
  await repository.orders.update(order.id, { status: "cancelled" });
  const response = await PATCH(
    businessRequest(
      "http://localhost/api/shipments",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shipment.id, status: "departed" }),
      },
      contextA,
    ),
  );
  assert.equal(response.status, 409);
  assert.equal((await repository.shipments.get(shipment.id))?.status, "booked");
});

test("logistics list is tenant isolated", async () => {
  const { shipment } = await createOrderWithShipment();
  const companyAResponse = await listLogistics(
    businessRequest("http://localhost/api/logistics", {}, contextA),
  );
  const companyBResponse = await listLogistics(
    businessRequest("http://localhost/api/logistics", {}, contextB),
  );
  const companyARecords = (await companyAResponse.json()) as { id: string }[];
  const companyBRecords = (await companyBResponse.json()) as { id: string }[];
  assert.equal(companyARecords.some((record) => record.id === shipment.id), true);
  assert.equal(companyBRecords.some((record) => record.id === shipment.id), false);
});

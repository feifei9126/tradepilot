import assert from "node:assert/strict";
import test from "node:test";

import { GET as getDashboard } from "../../src/app/api/dashboard/route";
import { buildDashboard } from "../../src/lib/dashboard";
import { getBusinessRepository } from "../../src/lib/repositories";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

const input = {
  contacts: [
    { id: "c1", name: "One", stage: "converted", createdAt: "2026-01-01" },
    { id: "c2", name: "Two", stage: "new", createdAt: "2026-01-01" },
  ],
  products: [{ id: "p1", name: "Widget", unit: "件", costPrice: 4 }],
  inquiries: [
    {
      id: "i1",
      customer: "One",
      subject: "Quote",
      content: "",
      source: "email",
      status: "converted" as const,
      createdAt: "2026-06-01",
    },
  ],
  quotations: [
    {
      id: "q1",
      no: "Q-1",
      contactId: "c1",
      contactName: "One",
      items: [],
      totalAmount: 100,
      currency: "USD",
      tradeTerm: "FOB",
      status: "accepted",
      aiGenerated: false,
      createdAt: "2026-06-02",
    },
  ],
  orders: [
    {
      id: "o1",
      no: "O-1",
      contactId: "c1",
      contactName: "One",
      items: [{ productName: "Widget", quantity: 10 }],
      totalAmount: 100,
      status: "confirmed",
      deliveryDate: "2026-07-25",
      progressPercent: 20,
      createdAt: "2026-07-02",
    },
    {
      id: "o2",
      no: "O-2",
      contactId: "c1",
      contactName: "One",
      items: [{ productName: "Widget", quantity: 5 }],
      totalAmount: 50,
      status: "shipped",
      deliveryDate: "2026-07-01",
      progressPercent: 100,
      createdAt: "2026-06-02",
    },
  ],
};

test("dashboard values are derived deterministically from business records", () => {
  const dashboard = buildDashboard(input, new Date("2026-07-23T12:00:00Z"));

  assert.equal(dashboard.summary.revenue, 150);
  assert.equal(dashboard.kpi.grossMargin, 0.6);
  assert.equal(dashboard.kpi.conversionRate, 0.5);
  assert.equal(
    dashboard.salesFunnel.find((stage) => stage.stage === "订单")?.count,
    2,
  );
  assert.deepEqual(
    dashboard.deliveryAlerts.map((alert) => alert.daysRemaining),
    [2],
  );
  assert.equal(dashboard.followUps[0]?.days, 22);
});

test("cancelled orders are excluded from revenue and conversion", () => {
  const dashboard = buildDashboard(
    {
      ...input,
      orders: [{ ...input.orders[0], status: "cancelled" }],
    },
    new Date("2026-07-23T12:00:00Z"),
  );

  assert.equal(dashboard.summary.revenue, 0);
  assert.equal(dashboard.kpi.conversionRate, 0);
});

test("dashboard keeps mixed-currency order totals separate", () => {
  const dashboard = buildDashboard(
    {
      ...input,
      orders: [
        { ...input.orders[0], currency: "USD", totalAmount: 100 },
        { ...input.orders[1], currency: "EUR", totalAmount: 50 },
      ],
    },
    new Date("2026-07-23T12:00:00Z"),
  );

  assert.deepEqual(dashboard.summary.revenueByCurrency, {
    USD: 100,
    EUR: 50,
  });
});

test("dashboard route derives data only from the current tenant", async () => {
  const repository = await getBusinessRepository(contextA);
  const contact = await repository.contacts.create({ name: "Dashboard Customer" });
  const quotation = await repository.quotations.create({
    contactId: contact.id,
    items: [{ productName: "Dashboard Product", quantity: 2, unitPrice: 50 }],
    currency: "USD",
    tradeTerm: "FOB",
    aiGenerated: false,
  });
  await repository.quotations.updateStatus(quotation.id, "accepted");
  await repository.orders.createFromQuotation({
    quotationId: quotation.id,
    deliveryDate: "2026-09-01",
  });

  const companyAResponse = await getDashboard(
    businessRequest("http://localhost/api/dashboard", {}, contextA),
  );
  const companyBResponse = await getDashboard(
    businessRequest("http://localhost/api/dashboard", {}, contextB),
  );
  const companyA = await companyAResponse.json();
  const companyB = await companyBResponse.json();
  assert.equal(companyA.summary.revenue, 100);
  assert.equal(companyB.summary.revenue, 0);
  assert.equal(companyB.summary.contacts, 0);
});

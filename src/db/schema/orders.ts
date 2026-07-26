import {
  boolean,
  date,
  decimal,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { contactPersons, contacts } from "./contacts";
import { quotations } from "./quotations";
import { users } from "./users";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    quotationId: uuid("quotation_id"),
    contactId: uuid("contact_id").notNull(),
    contactPersonId: uuid("contact_person_id"),
    orderNo: varchar("order_no", { length: 50 }).notNull(),
    customerOrderNo: varchar("customer_order_no", { length: 100 }),
    status: varchar("status", { length: 30 }).default("confirmed"),
    itemsJson: jsonb("items_json").notNull().default([]),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("USD"),
    tradeTerm: varchar("trade_term", { length: 10 }).default("FOB"),
    paymentTerm: varchar("payment_term", { length: 50 }),
    depositPct: decimal("deposit_pct", { precision: 5, scale: 2 }),
    deliveryDate: date("delivery_date"),
    factoryDate: date("factory_date"),
    shippingDate: date("shipping_date"),
    progressPercent: integer("progress_percent").default(0),
    commsJson: jsonb("comms_json").default([]),
    notes: text("notes"),
    aiRiskLevel: varchar("ai_risk_level", { length: 10 }).default("low"),
    tags: text("tags").array(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_company_id_id_unique").on(table.companyId, table.id),
    uniqueIndex("orders_company_no_unique").on(table.companyId, table.orderNo),
    uniqueIndex("orders_company_quotation_unique").on(
      table.companyId,
      table.quotationId,
    ),
    foreignKey({
      columns: [table.companyId, table.quotationId],
      foreignColumns: [quotations.companyId, quotations.id],
      name: "orders_company_quotation_fk",
    }),
    foreignKey({
      columns: [table.companyId, table.contactId],
      foreignColumns: [contacts.companyId, contacts.id],
      name: "orders_company_contact_fk",
    }),
    foreignKey({
      columns: [table.companyId, table.contactPersonId],
      foreignColumns: [contactPersons.companyId, contactPersons.id],
      name: "orders_company_contact_person_fk",
    }),
  ],
);

export const orderMilestones = pgTable(
  "order_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    orderId: uuid("order_id").notNull(),
    milestone: varchar("milestone", { length: 100 }).notNull(),
    plannedDate: date("planned_date"),
    actualDate: date("actual_date"),
    status: varchar("status", { length: 20 }).default("pending"),
    notes: text("notes"),
    aiExtracted: boolean("ai_extracted").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.companyId, table.orderId],
      foreignColumns: [orders.companyId, orders.id],
      name: "order_milestones_company_order_fk",
    }).onDelete("cascade"),
  ],
);

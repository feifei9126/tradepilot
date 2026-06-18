import { pgTable, uuid, varchar, text, decimal, date, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { quotations } from "./quotations";
import { contacts, contactPersons } from "./contacts";
import { users } from "./users";

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  quotationId: uuid("quotation_id").references(() => quotations.id),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  contactPersonId: uuid("contact_person_id").references(() => contactPersons.id),
  orderNo: varchar("order_no", { length: 50 }).notNull(),
  customerOrderNo: varchar("customer_order_no", { length: 100 }),
  status: varchar("status", { length: 30 }).default("confirmed"),
  // confirmed → in_production → inspection → ready → shipped → completed → cancelled
  itemsJson: jsonb("items_json").notNull().default([]),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  tradeTerm: varchar("trade_term", { length: 10 }).default("FOB"),
  paymentTerm: varchar("payment_term", { length: 50 }),
  depositPct: decimal("deposit_pct", { precision: 5, scale: 2 }),
  deliveryDate: date("delivery_date"),
  factoryDate: date("factory_date"),
  shippingDate: date("shipping_date"),
  notes: text("notes"),
  aiRiskLevel: varchar("ai_risk_level", { length: 10 }).default("low"),
  tags: text("tags").array(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const orderMilestones = pgTable("order_milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  milestone: varchar("milestone", { length: 100 }).notNull(),
  // order_confirmed, material_ready, cutting, assembly, packing, inspection, ready
  plannedDate: date("planned_date"),
  actualDate: date("actual_date"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, completed, delayed
  notes: text("notes"),
  aiExtracted: boolean("ai_extracted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

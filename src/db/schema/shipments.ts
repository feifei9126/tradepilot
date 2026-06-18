import { pgTable, uuid, varchar, text, decimal, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { orders } from "./orders";

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  method: varchar("method", { length: 20 }).default("sea"), // sea, air, express, truck
  carrier: varchar("carrier", { length: 100 }),
  containerNo: varchar("container_no", { length: 50 }),
  bookingNo: varchar("booking_no", { length: 100 }),
  billOfLadingNo: varchar("bill_of_lading_no", { length: 100 }),
  etd: date("etd"),
  eta: date("eta"),
  actualDeparture: date("actual_departure"),
  actualArrival: date("actual_arrival"),
  trackingUrl: text("tracking_url"),
  status: varchar("status", { length: 20 }).default("pending"),
  // pending, booked, departed, in_transit, arrived
  freightCost: decimal("freight_cost", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  shipmentId: uuid("shipment_id").references(() => shipments.id),
  docType: varchar("doc_type", { length: 30 }).notNull(),
  // proforma_invoice, commercial_invoice, packing_list, co, form_a, bl
  docNo: varchar("doc_no", { length: 100 }),
  fileUrl: text("file_url"),
  aiGenerated: boolean("ai_generated").default(false),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

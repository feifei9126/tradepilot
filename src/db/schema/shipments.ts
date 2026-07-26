import {
  boolean,
  date,
  decimal,
  foreignKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { orders } from "./orders";

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    orderId: uuid("order_id").notNull(),
    method: varchar("method", { length: 20 }).default("sea"),
    carrier: varchar("carrier", { length: 100 }),
    referenceNo: varchar("reference_no", { length: 100 }),
    containerNo: varchar("container_no", { length: 50 }),
    bookingNo: varchar("booking_no", { length: 100 }),
    billOfLadingNo: varchar("bill_of_lading_no", { length: 100 }),
    etd: date("etd"),
    eta: date("eta"),
    actualDeparture: date("actual_departure"),
    actualArrival: date("actual_arrival"),
    trackingUrl: text("tracking_url"),
    status: varchar("status", { length: 20 }).default("booked"),
    freightCost: decimal("freight_cost", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("shipments_company_id_id_unique").on(table.companyId, table.id),
    uniqueIndex("shipments_company_order_unique").on(
      table.companyId,
      table.orderId,
    ),
    foreignKey({
      columns: [table.companyId, table.orderId],
      foreignColumns: [orders.companyId, orders.id],
      name: "shipments_company_order_fk",
    }).onDelete("cascade"),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    orderId: uuid("order_id").notNull(),
    shipmentId: uuid("shipment_id"),
    docType: varchar("doc_type", { length: 30 }).notNull(),
    docNo: varchar("doc_no", { length: 100 }),
    status: varchar("status", { length: 20 }).default("draft"),
    content: text("content"),
    fileUrl: text("file_url"),
    aiGenerated: boolean("ai_generated").default(false),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("documents_company_id_id_unique").on(table.companyId, table.id),
    uniqueIndex("documents_company_order_type_unique").on(
      table.companyId,
      table.orderId,
      table.docType,
    ),
    foreignKey({
      columns: [table.companyId, table.orderId],
      foreignColumns: [orders.companyId, orders.id],
      name: "documents_company_order_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.companyId, table.shipmentId],
      foreignColumns: [shipments.companyId, shipments.id],
      name: "documents_company_shipment_fk",
    }),
  ],
);

import {
  foreignKey,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { contacts } from "./contacts";
import { orders } from "./orders";

export const communications = pgTable(
  "communications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    contactId: uuid("contact_id"),
    orderId: uuid("order_id"),
    channel: varchar("channel", { length: 20 }).notNull(),
    direction: varchar("direction", { length: 10 }).default("outbound"),
    subject: varchar("subject", { length: 255 }),
    rawContent: text("raw_content"),
    aiSummary: text("ai_summary"),
    aiSentiment: varchar("ai_sentiment", { length: 20 }),
    aiActionItems: text("ai_action_items").array(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.companyId, table.contactId],
      foreignColumns: [contacts.companyId, contacts.id],
      name: "communications_company_contact_fk",
    }),
    foreignKey({
      columns: [table.companyId, table.orderId],
      foreignColumns: [orders.companyId, orders.id],
      name: "communications_company_order_fk",
    }),
  ],
);

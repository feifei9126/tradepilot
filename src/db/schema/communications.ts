import { pgTable, uuid, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { contacts } from "./contacts";
import { orders } from "./orders";

export const communications = pgTable("communications", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id),
  orderId: uuid("order_id").references(() => orders.id),
  channel: varchar("channel", { length: 20 }).notNull(), // email, whatsapp, wechat, call, meeting
  direction: varchar("direction", { length: 10 }).default("outbound"), // inbound, outbound
  subject: varchar("subject", { length: 255 }),
  rawContent: text("raw_content"),
  aiSummary: text("ai_summary"),
  aiSentiment: varchar("ai_sentiment", { length: 20 }),
  aiActionItems: text("ai_action_items").array(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

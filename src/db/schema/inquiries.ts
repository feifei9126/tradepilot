import { pgTable, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { contacts, contactPersons } from "./contacts";

export const inquiries = pgTable("inquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  contactPersonId: uuid("contact_person_id").references(() => contactPersons.id),
  subject: varchar("subject", { length: 255 }),
  source: varchar("source", { length: 50 }), // alibaba, email, whatsapp, wechat, manual
  aiSummary: text("ai_summary"),
  rawText: text("raw_text"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, quoted, converted, lost
  productsJson: jsonb("products_json").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

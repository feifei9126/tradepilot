import { pgTable, uuid, varchar, text, decimal, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { inquiries } from "./inquiries";
import { contacts, contactPersons } from "./contacts";
import { users } from "./users";

export const quotations = pgTable("quotations", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  inquiryId: uuid("inquiry_id").references(() => inquiries.id),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  contactPersonId: uuid("contact_person_id").references(() => contactPersons.id),
  quotationNo: varchar("quotation_no", { length: 50 }).notNull(),
  tradeTerm: varchar("trade_term", { length: 10 }).default("FOB"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  itemsJson: jsonb("items_json").notNull().default([]),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  costBreakdown: jsonb("cost_breakdown").default({}),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }),
  validityDays: integer("validity_days").default(7),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).default("draft"), // draft, sent, accepted, rejected, expired
  aiGenerated: boolean("ai_generated").default(false),
  pdfUrl: text("pdf_url"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

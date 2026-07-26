import {
  boolean,
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
import { inquiries } from "./inquiries";
import { users } from "./users";

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    inquiryId: uuid("inquiry_id"),
    contactId: uuid("contact_id").notNull(),
    contactPersonId: uuid("contact_person_id"),
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
    status: varchar("status", { length: 20 }).default("draft"),
    aiGenerated: boolean("ai_generated").default(false),
    pdfUrl: text("pdf_url"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("quotations_company_id_id_unique").on(table.companyId, table.id),
    uniqueIndex("quotations_company_no_unique").on(
      table.companyId,
      table.quotationNo,
    ),
    foreignKey({
      columns: [table.companyId, table.inquiryId],
      foreignColumns: [inquiries.companyId, inquiries.id],
      name: "quotations_company_inquiry_fk",
    }),
    foreignKey({
      columns: [table.companyId, table.contactId],
      foreignColumns: [contacts.companyId, contacts.id],
      name: "quotations_company_contact_fk",
    }),
    foreignKey({
      columns: [table.companyId, table.contactPersonId],
      foreignColumns: [contactPersons.companyId, contactPersons.id],
      name: "quotations_company_contact_person_fk",
    }),
  ],
);

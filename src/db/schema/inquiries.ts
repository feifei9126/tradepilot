import {
  foreignKey,
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

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    contactId: uuid("contact_id"),
    contactPersonId: uuid("contact_person_id"),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }),
    source: varchar("source", { length: 50 }),
    aiSummary: text("ai_summary"),
    aiReply: text("ai_reply"),
    rawText: text("raw_text"),
    status: varchar("status", { length: 20 }).default("pending"),
    productsJson: jsonb("products_json").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("inquiries_company_id_id_unique").on(table.companyId, table.id),
    foreignKey({
      columns: [table.companyId, table.contactId],
      foreignColumns: [contacts.companyId, contacts.id],
      name: "inquiries_company_contact_fk",
    }),
    foreignKey({
      columns: [table.companyId, table.contactPersonId],
      foreignColumns: [contactPersons.companyId, contactPersons.id],
      name: "inquiries_company_contact_person_fk",
    }),
  ],
);

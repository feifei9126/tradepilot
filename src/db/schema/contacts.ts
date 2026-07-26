import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    country: varchar("country", { length: 100 }),
    city: varchar("city", { length: 100 }),
    website: text("website"),
    source: varchar("source", { length: 50 }),
    tags: text("tags").array(),
    notes: text("notes"),
    grade: varchar("grade", { length: 10 }),
    stage: varchar("stage", { length: 50 }),
    score: integer("score").default(0),
    isActive: boolean("is_active").default(true),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("contacts_company_id_id_unique").on(table.companyId, table.id),
  ],
);

export const contactPersons = pgTable(
  "contact_persons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    contactId: uuid("contact_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    whatsapp: varchar("whatsapp", { length: 50 }),
    wechat: varchar("wechat", { length: 50 }),
    position: varchar("position", { length: 100 }),
    isPrimary: boolean("is_primary").default(false),
    isDecisionMaker: boolean("is_decision_maker").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("contact_persons_company_id_id_unique").on(
      table.companyId,
      table.id,
    ),
    foreignKey({
      columns: [table.companyId, table.contactId],
      foreignColumns: [contacts.companyId, contacts.id],
      name: "contact_persons_company_contact_fk",
    }).onDelete("cascade"),
  ],
);

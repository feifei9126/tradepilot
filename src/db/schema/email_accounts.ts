import { sql } from "drizzle-orm";
import {
  boolean,
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

export const emailAccounts = pgTable(
  "email_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 24 }).notNull(),
    smtpHost: varchar("smtp_host", { length: 253 }),
    smtpPort: integer("smtp_port"),
    smtpSecure: boolean("smtp_secure").default(true).notNull(),
    imapHost: varchar("imap_host", { length: 253 }),
    imapPort: integer("imap_port"),
    imapSecure: boolean("imap_secure").default(true).notNull(),
    imapMailbox: varchar("imap_mailbox", { length: 255 }).default("INBOX"),
    encryptedCredentials: text("encrypted_credentials"),
    credentialsConfigured: boolean("credentials_configured").default(false).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    healthStatus: varchar("health_status", { length: 20 }).default("unknown").notNull(),
    lastError: text("last_error"),
    syncCursor: jsonb("sync_cursor").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_accounts_company_id_id_unique").on(table.companyId, table.id),
    uniqueIndex("email_accounts_company_email_unique").on(table.companyId, sql`lower(${table.email})`),
  ],
);

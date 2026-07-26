import { foreignKey, index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { emailAccounts } from "./email_accounts";

export const emailThreads = pgTable(
  "email_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
    accountId: uuid("account_id").notNull(),
    subject: varchar("subject", { length: 500 }).default("").notNull(),
    participants: jsonb("participants").default([]).notNull(),
    messageCount: integer("message_count").default(0).notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_threads_company_id_id_unique").on(table.companyId, table.id),
    index("email_threads_account_last_idx").on(table.accountId, table.lastMessageAt),
    foreignKey({
      columns: [table.companyId, table.accountId],
      foreignColumns: [emailAccounts.companyId, emailAccounts.id],
      name: "email_threads_company_account_fk",
    }).onDelete("cascade"),
  ],
);

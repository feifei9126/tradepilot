import { foreignKey, index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { emailAccounts } from "./email_accounts";

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
    accountId: uuid("account_id"),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerEventId: varchar("provider_event_id", { length: 512 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").default({}).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("email_events_provider_event_unique").on(table.provider, table.providerEventId),
    index("email_events_company_received_idx").on(table.companyId, table.receivedAt),
    foreignKey({ columns: [table.companyId, table.accountId], foreignColumns: [emailAccounts.companyId, emailAccounts.id], name: "email_events_company_account_fk" }).onDelete("cascade"),
  ],
);

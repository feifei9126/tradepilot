import { foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { emailAccounts } from "./email_accounts";
import { users } from "./users";

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
    accountId: uuid("account_id").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 24 }).default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    leasedUntil: timestamp("leased_until", { withTimezone: true }),
    externalId: varchar("external_id", { length: 512 }),
    lastErrorCode: varchar("last_error_code", { length: 100 }),
    lastError: text("last_error"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_outbox_company_id_id_unique").on(table.companyId, table.id),
    uniqueIndex("email_outbox_company_idempotency_unique").on(table.companyId, table.idempotencyKey),
    index("email_outbox_status_attempt_idx").on(table.status, table.nextAttemptAt),
    foreignKey({ columns: [table.companyId, table.accountId], foreignColumns: [emailAccounts.companyId, emailAccounts.id], name: "email_outbox_company_account_fk" }).onDelete("cascade"),
  ],
);

import { foreignKey, index, pgTable, uniqueIndex, uuid, varchar, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const paymentAccounts = pgTable("payment_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 16 }).notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  publicAccountId: varchar("public_account_id", { length: 80 }).notNull(),
  encryptedCredentials: text("encrypted_credentials"),
  credentialsConfigured: boolean("credentials_configured").default(false).notNull(),
  status: varchar("status", { length: 16 }).default("active").notNull(),
  healthStatus: varchar("health_status", { length: 16 }).default("unknown").notNull(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("payment_accounts_company_id_unique").on(table.companyId, table.id),
  uniqueIndex("payment_accounts_public_id_unique").on(table.publicAccountId),
  uniqueIndex("payment_accounts_company_public_id_unique").on(table.companyId, table.publicAccountId),
  index("payment_accounts_company_provider_idx").on(table.companyId, table.provider),
  foreignKey({ columns: [table.companyId], foreignColumns: [companies.id], name: "payment_accounts_company_fk" }).onDelete("cascade"),
]);

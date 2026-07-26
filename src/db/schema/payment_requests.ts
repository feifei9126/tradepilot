import { foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { orders } from "./orders";
import { users } from "./users";
import { paymentAccounts } from "./payment_accounts";

export const paymentRequests = pgTable("payment_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull(),
  orderId: uuid("order_id").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  publicTokenHash: varchar("public_token_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 24 }).default("pending").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("payment_requests_company_id_unique").on(table.companyId, table.id),
  uniqueIndex("payment_requests_token_hash_unique").on(table.publicTokenHash),
  index("payment_requests_company_order_idx").on(table.companyId, table.orderId),
  foreignKey({ columns: [table.companyId], foreignColumns: [companies.id], name: "payment_requests_company_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.companyId, table.orderId], foreignColumns: [orders.companyId, orders.id], name: "payment_requests_order_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdBy], foreignColumns: [users.id], name: "payment_requests_created_by_fk" }),
]);

export const paymentAttempts = pgTable("payment_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull(),
  requestId: uuid("request_id").notNull(),
  paymentAccountId: uuid("payment_account_id").notNull(),
  provider: varchar("provider", { length: 16 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
  providerTransactionId: varchar("provider_transaction_id", { length: 512 }),
  paymentUrl: text("payment_url"),
  codeUrl: text("code_url"),
  amountMinor: integer("amount_minor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 24 }).default("pending").notNull(),
  failureCode: varchar("failure_code", { length: 100 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("payment_attempts_company_id_unique").on(table.companyId, table.id),
  uniqueIndex("payment_attempts_company_idempotency_unique").on(table.companyId, table.idempotencyKey),
  index("payment_attempts_request_status_idx").on(table.requestId, table.status),
  foreignKey({ columns: [table.companyId, table.requestId], foreignColumns: [paymentRequests.companyId, paymentRequests.id], name: "payment_attempts_request_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.companyId, table.paymentAccountId], foreignColumns: [paymentAccounts.companyId, paymentAccounts.id], name: "payment_attempts_account_fk" }).onDelete("restrict"),
]);

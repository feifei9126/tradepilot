import { foreignKey, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { paymentAttempts, paymentRequests } from "./payment_requests";
import { users } from "./users";

export const paymentRefunds = pgTable("payment_refunds", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull(),
  requestId: uuid("request_id").notNull(),
  attemptId: uuid("attempt_id").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  providerRefundId: varchar("provider_refund_id", { length: 512 }),
  status: varchar("status", { length: 16 }).default("pending").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("payment_refunds_company_id_unique").on(table.companyId, table.id),
  uniqueIndex("payment_refunds_company_idempotency_unique").on(table.companyId, table.idempotencyKey),
  uniqueIndex("payment_refunds_provider_id_unique").on(table.providerRefundId),
  index("payment_refunds_request_idx").on(table.companyId, table.requestId),
  foreignKey({ columns: [table.companyId], foreignColumns: [companies.id], name: "payment_refunds_company_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.companyId, table.requestId], foreignColumns: [paymentRequests.companyId, paymentRequests.id], name: "payment_refunds_request_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.companyId, table.attemptId], foreignColumns: [paymentAttempts.companyId, paymentAttempts.id], name: "payment_refunds_attempt_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdBy], foreignColumns: [users.id], name: "payment_refunds_created_by_fk" }),
]);

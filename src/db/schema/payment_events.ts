import { foreignKey, index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const paymentProviderEvents = pgTable("payment_provider_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 16 }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 512 }).notNull(),
  payloadHash: varchar("payload_hash", { length: 128 }).notNull(),
  payload: jsonb("payload").default({}).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("payment_events_company_id_unique").on(table.companyId, table.id),
  uniqueIndex("payment_events_provider_event_unique").on(table.provider, table.providerEventId),
  index("payment_events_company_received_idx").on(table.companyId, table.receivedAt),
  foreignKey({ columns: [table.companyId], foreignColumns: [companies.id], name: "payment_events_company_fk" }).onDelete("cascade"),
]);

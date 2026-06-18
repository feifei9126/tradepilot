import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const systemSettings = pgTable("system_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  valueJson: jsonb("value_json").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

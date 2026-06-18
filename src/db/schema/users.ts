import { pgTable, uuid, varchar, boolean, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  role: varchar("role", { length: 20 }).default("member"),
  avatarUrl: text("avatar_url"),
  settings: jsonb("settings").default({}),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

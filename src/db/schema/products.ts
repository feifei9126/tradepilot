import { pgTable, uuid, varchar, text, decimal, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  modelNo: varchar("model_no", { length: 100 }),
  category: varchar("category", { length: 100 }),
  hsCode: varchar("hs_code", { length: 20 }),
  costPrice: decimal("cost_price", { precision: 12, scale: 2 }),
  unit: varchar("unit", { length: 20 }).default("pcs"),
  moq: integer("moq").default(1),
  description: text("description"),
  specJson: jsonb("spec_json").default({}),
  images: text("images").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

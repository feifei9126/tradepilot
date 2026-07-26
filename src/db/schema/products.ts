import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
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
    stockQuantity: integer("stock_quantity").default(0),
    lowStockThreshold: integer("low_stock_threshold").default(0),
    warehouse: varchar("warehouse", { length: 255 }),
    source: varchar("source", { length: 50 }),
    media: jsonb("media").default([]),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("products_company_id_id_unique").on(table.companyId, table.id),
  ],
);

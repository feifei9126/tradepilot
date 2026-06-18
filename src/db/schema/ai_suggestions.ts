import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const aiSuggestions = pgTable("ai_suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  contextType: varchar("context_type", { length: 30 }).notNull(), // order, contact, inquiry, quotation
  contextId: uuid("context_id").notNull(),
  suggestion: text("suggestion").notNull(),
  priority: varchar("priority", { length: 10 }).default("normal"), // low, normal, high, urgent
  category: varchar("category", { length: 50 }), // reminder, risk, opportunity, action_item
  isRead: boolean("is_read").default(false),
  isResolved: boolean("is_resolved").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

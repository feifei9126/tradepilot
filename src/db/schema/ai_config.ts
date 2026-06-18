import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const aiProviderConfigs = pgTable("ai_provider_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  providerId: varchar("provider_id", { length: 50 }).notNull(), // openai, tongyi, deepseek, ollama
  apiKeyEncrypted: text("api_key_encrypted"),
  baseUrl: text("base_url"),
  enabledModels: text("enabled_models").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const aiTaskMappings = pgTable("ai_task_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  taskKey: varchar("task_key", { length: 50 }).notNull(),
  // quotation, inquiry_extraction, order_suggestion, communication_summary, document_generation, customer_analysis, embedding
  providerId: varchar("provider_id", { length: 50 }).notNull(),
  modelId: varchar("model_id", { length: 100 }).notNull(),
});

import { pgTable, uuid, varchar, text, decimal, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { products } from "./products";
import { companies } from "./companies";

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  country: varchar("country", { length: 100 }),
  category: varchar("category", { length: 50 }), // material, processing, logistics
  rating: integer("rating").default(3),
  tags: text("tags").array(),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  leadTimeDays: integer("lead_time_days"),
  moq: integer("moq"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const supplierProducts = pgTable("supplier_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").references(() => suppliers.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),
  moq: integer("moq"),
  leadTimeDays: integer("lead_time_days"),
  isPreferred: boolean("is_preferred").default(false),
});

// 2. 库存/进销存
export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  address: text("address"),
  contactName: varchar("contact_name", { length: 100 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  productId: uuid("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").default(0),
  reservedQuantity: integer("reserved_quantity").default(0),
  availableQuantity: integer("available_quantity").default(0),
  location: varchar("location", { length: 100 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  type: varchar("type", { length: 30 }).notNull(), // inbound, outbound, adjustment, transfer
  quantity: integer("quantity").notNull(),
  referenceType: varchar("reference_type", { length: 30 }), // purchase_order, sales_order, adjustment
  referenceId: uuid("reference_id"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 3. 采购管理
export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id).notNull(),
  poNo: varchar("po_no", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).default("draft"), // draft, sent, confirmed, partial, received, cancelled
  itemsJson: text("items_json").default("[]"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  expectedDate: timestamp("expected_date"),
  receivedDate: timestamp("received_date"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 4. 财务/应收应付
export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  invoiceNo: varchar("invoice_no", { length: 50 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // commercial_invoice, proforma, credit_note, debit_note
  amount: decimal("amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, paid, overdue, cancelled
  issueDate: timestamp("issue_date"),
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  category: varchar("category", { length: 30 }).notNull(), // freight, insurance, inspection, commission, other
  amount: decimal("amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  description: text("description"),
  receiptUrl: text("receipt_url"),
  occurredAt: timestamp("occurred_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 5. 海关数据
export const customsRecords = pgTable("customs_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  productId: uuid("product_id").references(() => products.id),
  hsCode: varchar("hs_code", { length: 20 }),
  destinationCountry: varchar("destination_country", { length: 100 }),
  originCountry: varchar("origin_country", { length: 100 }).default("China"),
  tradeType: varchar("trade_type", { length: 10 }), // export, import
  shipperName: varchar("shipper_name", { length: 255 }),
  consigneeName: varchar("consignee_name", { length: 255 }),
  productDescription: text("product_description"),
  quantity: decimal("quantity", { precision: 12, scale: 2 }),
  unit: varchar("unit", { length: 20 }),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  shipmentDate: timestamp("shipment_date"),
  portOfLoading: varchar("port_of_loading", { length: 100 }),
  portOfDestination: varchar("port_of_destination", { length: 100 }),
  sourceFile: varchar("source_file", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 6. EDM 邮件营销
export const emailCampaigns = pgTable("email_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content"),
  senderEmail: varchar("sender_email", { length: 255 }),
  senderName: varchar("sender_name", { length: 100 }),
  status: varchar("status", { length: 20 }).default("draft"), // draft, sending, sent, paused
  sentCount: integer("sent_count").default(0),
  openCount: integer("open_count").default(0),
  replyCount: integer("reply_count").default(0),
  bounceCount: integer("bounce_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
});

// 7. OA 审批/任务
export const approvalTemplates = pgTable("approval_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(), // leave, expense, contract, purchase, other
  stepsJson: text("steps_json").default("[]"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  templateId: uuid("template_id").references(() => approvalTemplates.id),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, rejected, cancelled
  currentStep: integer("current_step").default(0),
  totalSteps: integer("total_steps").default(1),
  submitterId: uuid("submitter_id"),
  contentJson: text("content_json").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const approvalSteps = pgTable("approval_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  approvalId: uuid("approval_id").references(() => approvals.id).notNull(),
  stepOrder: integer("step_order").notNull(),
  approverId: uuid("approver_id"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, rejected
  comment: text("comment"),
  processedAt: timestamp("processed_at"),
});

// 8. 知识库
export const knowledgeArticles = pgTable("knowledge_articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  category: varchar("category", { length: 50 }), // product, process, policy, faq
  tags: text("tags").array(),
  attachments: text("attachments").array(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 9. 汇率配置
export const exchangeRateConfigs = pgTable("exchange_rate_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  baseCurrency: varchar("base_currency", { length: 3 }).default("USD"),
  provider: varchar("provider", { length: 30 }).default("alibaba"), // alibaba, exchangerate-api, openexchangerates, manual
  apiKey: text("api_key"),
  updateInterval: integer("update_interval").default(3600),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 10. 通知
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  userId: uuid("user_id"),
  type: varchar("type", { length: 30 }).notNull(), // task, approval, reminder, system
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  referenceType: varchar("reference_type", { length: 30 }),
  referenceId: uuid("reference_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 11. 操作日志
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  userId: uuid("user_id"),
  action: varchar("action", { length: 50 }).notNull(), // create, update, delete, view, export
  entityType: varchar("entity_type", { length: 50 }).notNull(), // contact, order, product, etc.
  entityId: uuid("entity_id"),
  detailsJson: text("details_json"),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 12. 海关数据热点产品
export const customsHotProducts = pgTable("customs_hot_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  hsCode: varchar("hs_code", { length: 20 }),
  productName: text("product_name"),
  destinationCountry: varchar("destination_country", { length: 100 }),
  totalValue: decimal("total_value", { precision: 14, scale: 2 }),
  totalQuantity: decimal("total_quantity", { precision: 14, scale: 2 }),
  tradeCount: integer("trade_count"),
  period: varchar("period", { length: 10 }), // 2026-01, 2026-Q1
  analyzedAt: timestamp("analyzed_at").defaultNow(),
});

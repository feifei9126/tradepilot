CREATE TABLE IF NOT EXISTS "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"details_json" text,
	"ip_address" varchar(50),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_provider_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider_id" varchar(50) NOT NULL,
	"api_key_encrypted" text,
	"base_url" text,
	"enabled_models" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"context_type" varchar(30) NOT NULL,
	"context_id" uuid NOT NULL,
	"suggestion" text NOT NULL,
	"priority" varchar(10) DEFAULT 'normal',
	"category" varchar(50),
	"is_read" boolean DEFAULT false,
	"is_resolved" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_task_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"task_key" varchar(50) NOT NULL,
	"provider_id" varchar(50) NOT NULL,
	"model_id" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"approver_id" uuid,
	"status" varchar(20) DEFAULT 'pending',
	"comment" text,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(30) NOT NULL,
	"steps_json" text DEFAULT '[]',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"template_id" uuid,
	"title" varchar(255) NOT NULL,
	"type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"current_step" integer DEFAULT 0,
	"total_steps" integer DEFAULT 1,
	"submitter_id" uuid,
	"content_json" text DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"order_id" uuid,
	"channel" varchar(20) NOT NULL,
	"direction" varchar(10) DEFAULT 'outbound',
	"subject" varchar(255),
	"raw_content" text,
	"ai_summary" text,
	"ai_sentiment" varchar(20),
	"ai_action_items" text[],
	"occurred_at" timestamp with time zone DEFAULT now(),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"logo_url" text,
	"timezone" varchar(50) DEFAULT 'Asia/Shanghai',
	"currency" varchar(3) DEFAULT 'CNY',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"whatsapp" varchar(50),
	"wechat" varchar(50),
	"position" varchar(100),
	"is_primary" boolean DEFAULT false,
	"is_decision_maker" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"country" varchar(100),
	"city" varchar(100),
	"website" text,
	"source" varchar(50),
	"tags" text[],
	"notes" text,
	"grade" varchar(10),
	"stage" varchar(50),
	"score" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"last_contacted_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customs_hot_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hs_code" varchar(20),
	"product_name" text,
	"destination_country" varchar(100),
	"total_value" numeric(14, 2),
	"total_quantity" numeric(14, 2),
	"trade_count" integer,
	"period" varchar(10),
	"analyzed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customs_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid,
	"hs_code" varchar(20),
	"destination_country" varchar(100),
	"origin_country" varchar(100) DEFAULT 'China',
	"trade_type" varchar(10),
	"shipper_name" varchar(255),
	"consignee_name" varchar(255),
	"product_description" text,
	"quantity" numeric(12, 2),
	"unit" varchar(20),
	"total_value" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"shipment_date" timestamp,
	"port_of_loading" varchar(100),
	"port_of_destination" varchar(100),
	"source_file" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_sequences" (
	"company_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"year" integer NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "document_sequences_company_id_kind_year_pk" PRIMARY KEY("company_id","kind","year")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"shipment_id" uuid,
	"doc_type" varchar(30) NOT NULL,
	"doc_no" varchar(100),
	"status" varchar(20) DEFAULT 'draft',
	"content" text,
	"file_url" text,
	"ai_generated" boolean DEFAULT false,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"content" text,
	"sender_email" varchar(255),
	"sender_name" varchar(100),
	"status" varchar(20) DEFAULT 'draft',
	"sent_count" integer DEFAULT 0,
	"open_count" integer DEFAULT 0,
	"reply_count" integer DEFAULT 0,
	"bounce_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"scheduled_at" timestamp,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exchange_rate_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"base_currency" varchar(3) DEFAULT 'USD',
	"provider" varchar(30) DEFAULT 'alibaba',
	"api_key" text,
	"update_interval" integer DEFAULT 3600,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid,
	"category" varchar(30) NOT NULL,
	"amount" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"description" text,
	"receipt_url" text,
	"occurred_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"contact_person_id" uuid,
	"customer_name" varchar(255) NOT NULL,
	"subject" varchar(255),
	"source" varchar(50),
	"ai_summary" text,
	"ai_reply" text,
	"raw_text" text,
	"status" varchar(20) DEFAULT 'pending',
	"products_json" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0,
	"reserved_quantity" integer DEFAULT 0,
	"available_quantity" integer DEFAULT 0,
	"location" varchar(100),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"type" varchar(30) NOT NULL,
	"quantity" integer NOT NULL,
	"reference_type" varchar(30),
	"reference_id" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid,
	"invoice_no" varchar(50) NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"status" varchar(20) DEFAULT 'pending',
	"issue_date" timestamp,
	"due_date" timestamp,
	"paid_date" timestamp,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text,
	"category" varchar(50),
	"tags" text[],
	"attachments" text[],
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"type" varchar(30) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text,
	"reference_type" varchar(30),
	"reference_id" uuid,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"milestone" varchar(100) NOT NULL,
	"planned_date" date,
	"actual_date" date,
	"status" varchar(20) DEFAULT 'pending',
	"notes" text,
	"ai_extracted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"quotation_id" uuid,
	"contact_id" uuid NOT NULL,
	"contact_person_id" uuid,
	"order_no" varchar(50) NOT NULL,
	"customer_order_no" varchar(100),
	"status" varchar(30) DEFAULT 'confirmed',
	"items_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_amount" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"trade_term" varchar(10) DEFAULT 'FOB',
	"payment_term" varchar(50),
	"deposit_pct" numeric(5, 2),
	"delivery_date" date,
	"factory_date" date,
	"shipping_date" date,
	"progress_percent" integer DEFAULT 0,
	"comms_json" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"ai_risk_level" varchar(10) DEFAULT 'low',
	"tags" text[],
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"model_no" varchar(100),
	"category" varchar(100),
	"hs_code" varchar(20),
	"cost_price" numeric(12, 2),
	"unit" varchar(20) DEFAULT 'pcs',
	"moq" integer DEFAULT 1,
	"description" text,
	"spec_json" jsonb DEFAULT '{}'::jsonb,
	"images" text[],
	"stock_quantity" integer DEFAULT 0,
	"low_stock_threshold" integer DEFAULT 0,
	"warehouse" varchar(255),
	"source" varchar(50),
	"media" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"po_no" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'draft',
	"items_json" text DEFAULT '[]',
	"total_amount" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"expected_date" timestamp,
	"received_date" timestamp,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"inquiry_id" uuid,
	"contact_id" uuid NOT NULL,
	"contact_person_id" uuid,
	"quotation_no" varchar(50) NOT NULL,
	"trade_term" varchar(10) DEFAULT 'FOB',
	"currency" varchar(3) DEFAULT 'USD',
	"exchange_rate" numeric(10, 4),
	"items_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_amount" numeric(12, 2),
	"cost_breakdown" jsonb DEFAULT '{}'::jsonb,
	"profit_margin" numeric(5, 2),
	"validity_days" integer DEFAULT 7,
	"notes" text,
	"status" varchar(20) DEFAULT 'draft',
	"ai_generated" boolean DEFAULT false,
	"pdf_url" text,
	"sent_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"method" varchar(20) DEFAULT 'sea',
	"carrier" varchar(100),
	"reference_no" varchar(100),
	"container_no" varchar(50),
	"booking_no" varchar(100),
	"bill_of_lading_no" varchar(100),
	"etd" date,
	"eta" date,
	"actual_departure" date,
	"actual_arrival" date,
	"tracking_url" text,
	"status" varchar(20) DEFAULT 'booked',
	"freight_cost" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"unit_price" numeric(12, 2),
	"moq" integer,
	"lead_time_days" integer,
	"is_preferred" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_name" varchar(100),
	"phone" varchar(50),
	"email" varchar(255),
	"country" varchar(100),
	"category" varchar(50),
	"rating" integer DEFAULT 3,
	"tags" text[],
	"payment_terms" varchar(100),
	"lead_time_days" integer,
	"moq" integer,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"value_json" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" varchar(20) DEFAULT 'member',
	"avatar_url" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"address" text,
	"contact_name" varchar(100),
	"contact_phone" varchar(50),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_persons_company_id_id_unique" ON "contact_persons" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_company_id_id_unique" ON "contacts" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_company_id_id_unique" ON "documents" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_company_order_type_unique" ON "documents" USING btree ("company_id","order_id","doc_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inquiries_company_id_id_unique" ON "inquiries" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_company_id_id_unique" ON "orders" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_company_no_unique" ON "orders" USING btree ("company_id","order_no");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_company_quotation_unique" ON "orders" USING btree ("company_id","quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_company_id_id_unique" ON "products" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_company_id_id_unique" ON "quotations" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_company_no_unique" ON "quotations" USING btree ("company_id","quotation_no");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_company_id_id_unique" ON "shipments" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_company_order_unique" ON "shipments" USING btree ("company_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_company_id_id_unique" ON "users" USING btree ("company_id","id");--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_task_mappings" ADD CONSTRAINT "ai_task_mappings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_templates" ADD CONSTRAINT "approval_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_template_id_approval_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."approval_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_company_contact_fk" FOREIGN KEY ("company_id","contact_id") REFERENCES "public"."contacts"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_company_order_fk" FOREIGN KEY ("company_id","order_id") REFERENCES "public"."orders"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_persons" ADD CONSTRAINT "contact_persons_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_persons" ADD CONSTRAINT "contact_persons_company_contact_fk" FOREIGN KEY ("company_id","contact_id") REFERENCES "public"."contacts"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customs_records" ADD CONSTRAINT "customs_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customs_records" ADD CONSTRAINT "customs_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_order_fk" FOREIGN KEY ("company_id","order_id") REFERENCES "public"."orders"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_shipment_fk" FOREIGN KEY ("company_id","shipment_id") REFERENCES "public"."shipments"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate_configs" ADD CONSTRAINT "exchange_rate_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_company_contact_fk" FOREIGN KEY ("company_id","contact_id") REFERENCES "public"."contacts"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_company_contact_person_fk" FOREIGN KEY ("company_id","contact_person_id") REFERENCES "public"."contact_persons"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_milestones" ADD CONSTRAINT "order_milestones_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_milestones" ADD CONSTRAINT "order_milestones_company_order_fk" FOREIGN KEY ("company_id","order_id") REFERENCES "public"."orders"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_quotation_fk" FOREIGN KEY ("company_id","quotation_id") REFERENCES "public"."quotations"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_contact_fk" FOREIGN KEY ("company_id","contact_id") REFERENCES "public"."contacts"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_contact_person_fk" FOREIGN KEY ("company_id","contact_person_id") REFERENCES "public"."contact_persons"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_inquiry_fk" FOREIGN KEY ("company_id","inquiry_id") REFERENCES "public"."inquiries"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_contact_fk" FOREIGN KEY ("company_id","contact_id") REFERENCES "public"."contacts"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_contact_person_fk" FOREIGN KEY ("company_id","contact_person_id") REFERENCES "public"."contact_persons"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_company_order_fk" FOREIGN KEY ("company_id","order_id") REFERENCES "public"."orders"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_persons_company_id_id_unique" ON "contact_persons" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_company_id_id_unique" ON "contacts" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_company_id_id_unique" ON "documents" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_company_order_type_unique" ON "documents" USING btree ("company_id","order_id","doc_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inquiries_company_id_id_unique" ON "inquiries" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_company_id_id_unique" ON "orders" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_company_no_unique" ON "orders" USING btree ("company_id","order_no");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_company_quotation_unique" ON "orders" USING btree ("company_id","quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_company_id_id_unique" ON "products" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_company_id_id_unique" ON "quotations" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_company_no_unique" ON "quotations" USING btree ("company_id","quotation_no");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_company_id_id_unique" ON "shipments" USING btree ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_company_order_unique" ON "shipments" USING btree ("company_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_company_id_id_unique" ON "users" USING btree ("company_id","id");

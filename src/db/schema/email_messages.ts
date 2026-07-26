import {
  bigint,
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { emailAccounts } from "./email_accounts";
import { emailThreads } from "./email_threads";

export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
    accountId: uuid("account_id").notNull(),
    threadId: uuid("thread_id").notNull(),
    normalizedMessageKey: varchar("normalized_message_key", { length: 512 }).notNull(),
    providerMessageId: varchar("provider_message_id", { length: 512 }),
    externalId: varchar("external_id", { length: 512 }),
    direction: varchar("direction", { length: 12 }).notNull(),
    folder: varchar("folder", { length: 32 }).notNull(),
    from: jsonb("from_addresses").default([]).notNull(),
    to: jsonb("to_addresses").default([]).notNull(),
    cc: jsonb("cc_addresses").default([]).notNull(),
    bcc: jsonb("bcc_addresses").default([]).notNull(),
    subject: varchar("subject", { length: 500 }).default("").notNull(),
    textBody: text("text_body"),
    htmlBody: text("html_body"),
    rawMimeObjectKey: varchar("raw_mime_object_key", { length: 1024 }),
    isRead: boolean("is_read").default(false).notNull(),
    isStarred: boolean("is_starred").default(false).notNull(),
    status: varchar("status", { length: 24 }).default("received").notNull(),
    errorCode: varchar("error_code", { length: 100 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_messages_company_id_id_unique").on(table.companyId, table.id),
    uniqueIndex("email_messages_account_key_unique").on(table.accountId, table.normalizedMessageKey),
    index("email_messages_thread_created_idx").on(table.threadId, table.createdAt),
    foreignKey({ columns: [table.companyId, table.accountId], foreignColumns: [emailAccounts.companyId, emailAccounts.id], name: "email_messages_company_account_fk" }).onDelete("cascade"),
    foreignKey({ columns: [table.companyId, table.threadId], foreignColumns: [emailThreads.companyId, emailThreads.id], name: "email_messages_company_thread_fk" }).onDelete("cascade"),
  ],
);

export const emailAttachments = pgTable(
  "email_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
    messageId: uuid("message_id").notNull(),
    filename: varchar("filename", { length: 500 }).notNull(),
    contentType: varchar("content_type", { length: 255 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    objectKey: varchar("object_key", { length: 1024 }).notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    contentId: varchar("content_id", { length: 512 }),
    disposition: varchar("disposition", { length: 20 }).default("attachment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_attachments_company_id_id_unique").on(table.companyId, table.id),
    uniqueIndex("email_attachments_message_object_unique").on(table.messageId, table.objectKey),
    foreignKey({ columns: [table.companyId, table.messageId], foreignColumns: [emailMessages.companyId, emailMessages.id], name: "email_attachments_company_message_fk" }).onDelete("cascade"),
  ],
);

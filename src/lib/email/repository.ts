import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { emailAccounts, emailEvents, emailMessages, emailOutbox, emailThreads } from "@/db/schema";
import { BusinessError } from "@/lib/business/errors";

import type {
  EmailAccount,
  EmailAddress,
  EmailMessage,
  EmailOutboxItem,
  EmailRepository,
  EmailThread,
  ProviderEmailEvent,
} from "./types";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() || new Date(0).toISOString();
}

function addresses(value: unknown): EmailAddress[] {
  return Array.isArray(value)
    ? value.filter((item): item is EmailAddress => Boolean(item && typeof item === "object" && "email" in item && typeof item.email === "string"))
    : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mapAccount(row: typeof emailAccounts.$inferSelect): EmailAccount {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    email: row.email,
    provider: row.provider === "resend" ? "resend" : "smtp_imap",
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    imapHost: row.imapHost,
    imapPort: row.imapPort,
    imapSecure: row.imapSecure,
    imapMailbox: row.imapMailbox,
    encryptedCredentials: row.encryptedCredentials,
    credentialsConfigured: row.credentialsConfigured,
    status: row.status === "disabled" ? "disabled" : "active",
    healthStatus: row.healthStatus === "healthy" || row.healthStatus === "error" ? row.healthStatus : "unknown",
    lastError: row.lastError,
    syncCursor: objectValue(row.syncCursor),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function mapThread(row: typeof emailThreads.$inferSelect): EmailThread {
  return {
    id: row.id,
    companyId: row.companyId,
    accountId: row.accountId,
    subject: row.subject,
    participants: addresses(row.participants),
    messageCount: row.messageCount,
    lastMessageAt: iso(row.lastMessageAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function mapMessage(row: typeof emailMessages.$inferSelect): EmailMessage {
  return {
    id: row.id,
    companyId: row.companyId,
    accountId: row.accountId,
    threadId: row.threadId,
    normalizedMessageKey: row.normalizedMessageKey,
    providerMessageId: row.providerMessageId,
    externalId: row.externalId,
    direction: row.direction === "outbound" ? "outbound" : "inbound",
    folder: row.folder === "sent" || row.folder === "draft" || row.folder === "trash" ? row.folder : "inbox",
    from: addresses(row.from),
    to: addresses(row.to),
    cc: addresses(row.cc),
    bcc: addresses(row.bcc),
    subject: row.subject,
    textBody: row.textBody,
    htmlBody: row.htmlBody,
    rawMimeObjectKey: row.rawMimeObjectKey,
    isRead: row.isRead,
    isStarred: row.isStarred,
    status: row.status,
    errorCode: row.errorCode,
    sentAt: row.sentAt?.toISOString() || null,
    receivedAt: row.receivedAt?.toISOString() || null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function mapOutbox(row: typeof emailOutbox.$inferSelect): EmailOutboxItem {
  return {
    id: row.id,
    companyId: row.companyId,
    accountId: row.accountId,
    idempotencyKey: row.idempotencyKey,
    payload: objectValue(row.payload),
    status: row.status,
    attemptCount: row.attemptCount,
    nextAttemptAt: iso(row.nextAttemptAt),
    leasedUntil: row.leasedUntil?.toISOString() || null,
    externalId: row.externalId,
    lastErrorCode: row.lastErrorCode,
    lastError: row.lastError,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function mapEvent(row: typeof emailEvents.$inferSelect): ProviderEmailEvent {
  return {
    id: row.id,
    companyId: row.companyId,
    accountId: row.accountId,
    provider: row.provider,
    providerEventId: row.providerEventId,
    eventType: row.eventType,
    payload: objectValue(row.payload),
    receivedAt: iso(row.receivedAt),
    processedAt: row.processedAt?.toISOString() || null,
  };
}

export function createMemoryEmailRepository(): EmailRepository {
  const accounts = new Map<string, EmailAccount>();
  const threads = new Map<string, EmailThread>();
  const messages = new Map<string, EmailMessage>();
  const outbox = new Map<string, EmailOutboxItem>();
  const events = new Map<string, ProviderEmailEvent>();

  return {
    async listAccounts(companyId) {
      return clone([...accounts.values()].filter((item) => item.companyId === companyId));
    },
    async createAccount(input) {
      const duplicate = [...accounts.values()].some((item) => item.companyId === input.companyId && item.email.toLowerCase() === input.email.toLowerCase());
      if (duplicate) throw new BusinessError("CONFLICT", "Email account already exists", 409);
      accounts.set(input.id, clone(input));
      return clone(input);
    },
    async updateAccount(companyId, id, patch) {
      const current = accounts.get(id);
      if (!current || current.companyId !== companyId) return null;
      const updated = { ...current, ...clone(patch), id, companyId, updatedAt: new Date().toISOString() };
      accounts.set(id, updated);
      return clone(updated);
    },
    async deactivateAccount(companyId, id) {
      const current = accounts.get(id);
      if (!current || current.companyId !== companyId) return null;
      const updated: EmailAccount = {
        ...current,
        status: "disabled",
        updatedAt: new Date().toISOString(),
      };
      accounts.set(id, updated);
      return clone(updated);
    },
    async listThreads(companyId, options = {}) {
      return clone([...threads.values()].filter((item) => item.companyId === companyId && (!options.accountId || item.accountId === options.accountId)).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)).slice(0, options.limit || 100));
    },
    async listMessages(companyId, options = {}) {
      return clone([...messages.values()].filter((item) => item.companyId === companyId && (!options.accountId || item.accountId === options.accountId) && (!options.threadId || item.threadId === options.threadId) && (!options.folder || item.folder === options.folder)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, options.limit || 100));
    },
    async updateMessage(companyId, id, patch) {
      const current = messages.get(id);
      if (!current || current.companyId !== companyId) return null;
      const updated = {
        ...current,
        ...(patch.isRead !== undefined ? { isRead: patch.isRead } : {}),
        ...(patch.isStarred !== undefined ? { isStarred: patch.isStarred } : {}),
        updatedAt: new Date().toISOString(),
      };
      messages.set(id, updated);
      return clone(updated);
    },
    async insertInboundMessage(input) {
      const existing = [...messages.values()].find((item) => item.companyId === input.companyId && item.accountId === input.accountId && item.normalizedMessageKey === input.normalizedMessageKey);
      if (existing) return clone(existing);
      const now = new Date().toISOString();
      const message: EmailMessage = {
        id: randomUUID(),
        ...input,
        providerMessageId: input.providerMessageId || null,
        externalId: null,
        cc: input.cc || [],
        bcc: input.bcc || [],
        textBody: input.textBody || null,
        htmlBody: input.htmlBody || null,
        rawMimeObjectKey: input.rawMimeObjectKey || null,
        isRead: false,
        isStarred: false,
        status: "received",
        errorCode: null,
        sentAt: input.sentAt || null,
        receivedAt: input.receivedAt || now,
        createdAt: now,
        updatedAt: now,
      };
      messages.set(message.id, message);
      const currentThread = threads.get(input.threadId);
      threads.set(input.threadId, currentThread
        ? { ...currentThread, messageCount: currentThread.messageCount + 1, lastMessageAt: message.receivedAt || now, updatedAt: now }
        : { id: input.threadId, companyId: input.companyId, accountId: input.accountId, subject: input.subject, participants: [...input.from, ...input.to], messageCount: 1, lastMessageAt: message.receivedAt || now, createdAt: now, updatedAt: now });
      return clone(message);
    },
    async enqueue(input) {
      const existing = [...outbox.values()].find((item) => item.companyId === input.companyId && item.idempotencyKey === input.idempotencyKey);
      if (existing) return clone(existing);
      outbox.set(input.id, clone(input));
      return clone(input);
    },
    async leaseOutbox({ now, leasedUntil, limit }) {
      const leased = [...outbox.values()].filter((item) => (item.status === "pending" || item.status === "retry") && item.nextAttemptAt <= now && (!item.leasedUntil || item.leasedUntil <= now)).slice(0, limit).map((item) => ({ ...item, status: "leased", leasedUntil, updatedAt: now }));
      leased.forEach((item) => outbox.set(item.id, item));
      return clone(leased);
    },
    async markOutbox(companyId, id, patch) {
      const current = outbox.get(id);
      if (!current || current.companyId !== companyId) return null;
      const updated = { ...current, ...clone(patch), id, companyId, updatedAt: new Date().toISOString() };
      outbox.set(id, updated);
      return clone(updated);
    },
    async recordProviderEvent(input) {
      const key = `${input.provider}:${input.providerEventId}`;
      const existing = events.get(key);
      if (existing) return { event: clone(existing), created: false };
      events.set(key, clone(input));
      return { event: clone(input), created: true };
    },
  };
}

export function createPostgresEmailRepository(db: Database): EmailRepository {
  return {
    async listAccounts(companyId) {
      return (await db.select().from(emailAccounts).where(eq(emailAccounts.companyId, companyId)).orderBy(asc(emailAccounts.name))).map(mapAccount);
    },
    async createAccount(input) {
      const [row] = await db.insert(emailAccounts).values({
        ...input,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt),
      }).returning();
      return mapAccount(row);
    },
    async updateAccount(companyId, id, patch) {
      const [row] = await db.update(emailAccounts).set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
        ...(patch.smtpHost !== undefined ? { smtpHost: patch.smtpHost } : {}),
        ...(patch.smtpPort !== undefined ? { smtpPort: patch.smtpPort } : {}),
        ...(patch.smtpSecure !== undefined ? { smtpSecure: patch.smtpSecure } : {}),
        ...(patch.imapHost !== undefined ? { imapHost: patch.imapHost } : {}),
        ...(patch.imapPort !== undefined ? { imapPort: patch.imapPort } : {}),
        ...(patch.imapSecure !== undefined ? { imapSecure: patch.imapSecure } : {}),
        ...(patch.imapMailbox !== undefined ? { imapMailbox: patch.imapMailbox } : {}),
        ...(patch.encryptedCredentials !== undefined ? { encryptedCredentials: patch.encryptedCredentials } : {}),
        ...(patch.credentialsConfigured !== undefined ? { credentialsConfigured: patch.credentialsConfigured } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.healthStatus !== undefined ? { healthStatus: patch.healthStatus } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.syncCursor !== undefined ? { syncCursor: patch.syncCursor } : {}),
        updatedAt: new Date(),
      }).where(and(eq(emailAccounts.companyId, companyId), eq(emailAccounts.id, id))).returning();
      return row ? mapAccount(row) : null;
    },
    async deactivateAccount(companyId, id) {
      const [row] = await db.update(emailAccounts).set({
        status: "disabled",
        updatedAt: new Date(),
      }).where(and(eq(emailAccounts.companyId, companyId), eq(emailAccounts.id, id))).returning();
      return row ? mapAccount(row) : null;
    },
    async listThreads(companyId, options = {}) {
      const where = [eq(emailThreads.companyId, companyId)];
      if (options.accountId) where.push(eq(emailThreads.accountId, options.accountId));
      const rows = await db.select().from(emailThreads).where(and(...where)).orderBy(desc(emailThreads.lastMessageAt)).limit(options.limit || 100);
      return rows.map(mapThread);
    },
    async listMessages(companyId, options = {}) {
      const where = [eq(emailMessages.companyId, companyId)];
      if (options.accountId) where.push(eq(emailMessages.accountId, options.accountId));
      if (options.threadId) where.push(eq(emailMessages.threadId, options.threadId));
      if (options.folder) where.push(eq(emailMessages.folder, options.folder));
      const rows = await db.select().from(emailMessages).where(and(...where)).orderBy(desc(emailMessages.createdAt)).limit(options.limit || 100);
      return rows.map(mapMessage);
    },
    async updateMessage(companyId, id, patch) {
      const [row] = await db.update(emailMessages).set({
        ...(patch.isRead !== undefined ? { isRead: patch.isRead } : {}),
        ...(patch.isStarred !== undefined ? { isStarred: patch.isStarred } : {}),
        updatedAt: new Date(),
      }).where(and(eq(emailMessages.companyId, companyId), eq(emailMessages.id, id))).returning();
      return row ? mapMessage(row) : null;
    },
    async insertInboundMessage(input) {
      return db.transaction(async (transaction) => {
        await transaction.insert(emailThreads).values({
          id: input.threadId,
          companyId: input.companyId,
          accountId: input.accountId,
          subject: input.subject,
          participants: [...input.from, ...input.to],
          messageCount: 0,
          lastMessageAt: new Date(input.receivedAt || input.sentAt || Date.now()),
        }).onConflictDoNothing({ target: emailThreads.id });
        const [inserted] = await transaction.insert(emailMessages).values({
          companyId: input.companyId,
          accountId: input.accountId,
          threadId: input.threadId,
          normalizedMessageKey: input.normalizedMessageKey,
          providerMessageId: input.providerMessageId || null,
          direction: input.direction,
          folder: input.folder,
          from: input.from,
          to: input.to,
          cc: input.cc || [],
          bcc: input.bcc || [],
          subject: input.subject,
          textBody: input.textBody || null,
          htmlBody: input.htmlBody || null,
          rawMimeObjectKey: input.rawMimeObjectKey || null,
          receivedAt: new Date(input.receivedAt || Date.now()),
          sentAt: input.sentAt ? new Date(input.sentAt) : null,
        }).onConflictDoNothing({ target: [emailMessages.accountId, emailMessages.normalizedMessageKey] }).returning();
        if (!inserted) {
          const [existing] = await transaction.select().from(emailMessages).where(and(eq(emailMessages.companyId, input.companyId), eq(emailMessages.accountId, input.accountId), eq(emailMessages.normalizedMessageKey, input.normalizedMessageKey))).limit(1);
          if (!existing) throw new BusinessError("CONFLICT", "Email message conflict", 409);
          return mapMessage(existing);
        }
        await transaction.update(emailThreads).set({
          messageCount: sql`${emailThreads.messageCount} + 1`,
          lastMessageAt: new Date(input.receivedAt || input.sentAt || Date.now()),
          updatedAt: new Date(),
        }).where(and(eq(emailThreads.companyId, input.companyId), eq(emailThreads.id, input.threadId)));
        return mapMessage(inserted);
      });
    },
    async enqueue(input) {
      const [inserted] = await db.insert(emailOutbox).values({
        ...input,
        nextAttemptAt: new Date(input.nextAttemptAt),
        leasedUntil: input.leasedUntil ? new Date(input.leasedUntil) : null,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt),
      }).onConflictDoNothing({ target: [emailOutbox.companyId, emailOutbox.idempotencyKey] }).returning();
      if (inserted) return mapOutbox(inserted);
      const [existing] = await db.select().from(emailOutbox).where(and(eq(emailOutbox.companyId, input.companyId), eq(emailOutbox.idempotencyKey, input.idempotencyKey))).limit(1);
      if (!existing) throw new BusinessError("CONFLICT", "Email outbox conflict", 409);
      return mapOutbox(existing);
    },
    async leaseOutbox({ now, leasedUntil, limit }) {
      return db.transaction(async (transaction) => {
        const rows = await transaction.select().from(emailOutbox).where(and(inArray(emailOutbox.status, ["pending", "retry"]), lte(emailOutbox.nextAttemptAt, new Date(now)), or(isNull(emailOutbox.leasedUntil), lte(emailOutbox.leasedUntil, new Date(now))))).orderBy(asc(emailOutbox.nextAttemptAt)).for("update", { skipLocked: true }).limit(limit);
        if (!rows.length) return [];
        const updated = await transaction.update(emailOutbox).set({ status: "leased", leasedUntil: new Date(leasedUntil), updatedAt: new Date(now) }).where(inArray(emailOutbox.id, rows.map((row) => row.id))).returning();
        return updated.map(mapOutbox);
      });
    },
    async markOutbox(companyId, id, patch) {
      const [row] = await db.update(emailOutbox).set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.attemptCount !== undefined ? { attemptCount: patch.attemptCount } : {}),
        ...(patch.nextAttemptAt !== undefined ? { nextAttemptAt: new Date(patch.nextAttemptAt) } : {}),
        ...(patch.leasedUntil !== undefined ? { leasedUntil: patch.leasedUntil ? new Date(patch.leasedUntil) : null } : {}),
        ...(patch.externalId !== undefined ? { externalId: patch.externalId } : {}),
        ...(patch.lastErrorCode !== undefined ? { lastErrorCode: patch.lastErrorCode } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        updatedAt: new Date(),
      }).where(and(eq(emailOutbox.companyId, companyId), eq(emailOutbox.id, id))).returning();
      return row ? mapOutbox(row) : null;
    },
    async recordProviderEvent(input) {
      const [inserted] = await db.insert(emailEvents).values({
        ...input,
        receivedAt: new Date(input.receivedAt),
        processedAt: input.processedAt ? new Date(input.processedAt) : null,
      }).onConflictDoNothing({ target: [emailEvents.provider, emailEvents.providerEventId] }).returning();
      if (inserted) return { event: mapEvent(inserted), created: true };
      const [existing] = await db.select().from(emailEvents).where(and(eq(emailEvents.provider, input.provider), eq(emailEvents.providerEventId, input.providerEventId))).limit(1);
      if (!existing) throw new BusinessError("CONFLICT", "Email event conflict", 409);
      return { event: mapEvent(existing), created: false };
    },
  };
}

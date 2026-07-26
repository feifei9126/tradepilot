import { createHash } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { paymentAccounts, paymentAttempts, paymentProviderEvents, paymentRefunds, paymentRequests, orders, companies } from "@/db/schema";
import { BusinessError } from "@/lib/business/errors";
import type { PaymentAccount, PaymentAttempt, PaymentProvider, PaymentProviderEvent, PaymentRefund, PaymentRequest, PaymentRequestStatus, OrderPaymentStatus } from "./types";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

export interface PaymentOrderSnapshot {
  id: string;
  companyId: string;
  orderNo: string;
  totalAmount: string;
  currency: string;
  paymentStatus: OrderPaymentStatus;
  amountPaidMinor: number;
  merchantName: string;
}

export interface PaymentRepository {
  listAccounts(companyId: string): Promise<PaymentAccount[]>;
  getAccountByPublicId(companyId: string, publicAccountId: string): Promise<PaymentAccount | null>;
  findAccountByPublicId(publicAccountId: string): Promise<PaymentAccount | null>;
  createAccount(input: PaymentAccount): Promise<PaymentAccount>;
  updateAccount(companyId: string, id: string, patch: Partial<PaymentAccount>): Promise<PaymentAccount | null>;
  getOrder(companyId: string, orderId: string): Promise<PaymentOrderSnapshot | null>;
  findRequestByOrderReference(companyId: string, orderNo: string): Promise<PaymentRequest | null>;
  createRequest(input: PaymentRequest): Promise<PaymentRequest>;
  getRequest(companyId: string, requestId: string): Promise<PaymentRequest | null>;
  listRequestsForOrder(companyId: string, orderId: string): Promise<PaymentRequest[]>;
  updateRequest(companyId: string, requestId: string, patch: Partial<PaymentRequest>): Promise<PaymentRequest | null>;
  getRequestByTokenHash(tokenHash: string): Promise<PaymentRequest | null>;
  listAttempts(companyId: string, requestId: string): Promise<PaymentAttempt[]>;
  listAttemptsForOrder(companyId: string, orderId: string): Promise<PaymentAttempt[]>;
  getAttempt(companyId: string, attemptId: string): Promise<PaymentAttempt | null>;
  findAttemptByIdempotency(companyId: string, idempotencyKey: string): Promise<PaymentAttempt | null>;
  findAttemptByProviderTransaction(companyId: string, provider: PaymentProvider, providerTransactionId: string): Promise<PaymentAttempt | null>;
  createAttempt(input: PaymentAttempt & { paymentAccountId: string }): Promise<PaymentAttempt>;
  updateAttempt(companyId: string, id: string, patch: Partial<PaymentAttempt>): Promise<PaymentAttempt | null>;
  recordProviderEvent(input: PaymentProviderEvent & { payload?: Record<string, unknown> }): Promise<{ event: PaymentProviderEvent; created: boolean }>;
  markProviderEventProcessed(provider: PaymentProvider, providerEventId: string): Promise<PaymentProviderEvent | null>;
  createRefund(input: PaymentRefund): Promise<PaymentRefund>;
  updateRefund(companyId: string, id: string, patch: Partial<PaymentRefund>): Promise<PaymentRefund | null>;
  listRefunds(companyId: string, requestId: string): Promise<PaymentRefund[]>;
  updateOrderPayment(companyId: string, orderId: string, paymentStatus: OrderPaymentStatus, amountPaidMinor: number): Promise<void>;
}

const clone = <T>(value: T): T => structuredClone(value);

export function createMemoryPaymentRepository(): PaymentRepository & { seedOrder(order: PaymentOrderSnapshot): void } {
  const accounts = new Map<string, PaymentAccount>();
  const ordersMap = new Map<string, PaymentOrderSnapshot>();
  const requests = new Map<string, PaymentRequest>();
  const attempts = new Map<string, PaymentAttempt & { paymentAccountId: string }>();
  const events = new Map<string, PaymentProviderEvent>();
  const refunds = new Map<string, PaymentRefund>();
  const repo: PaymentRepository & { seedOrder(order: PaymentOrderSnapshot): void } = {
    seedOrder(order) { ordersMap.set(`${order.companyId}:${order.id}`, clone(order)); },
    async listAccounts(companyId) { return clone([...accounts.values()].filter((account) => account.companyId === companyId)); },
    async getAccountByPublicId(companyId, publicAccountId) { const item = [...accounts.values()].find((account) => account.companyId === companyId && account.publicAccountId === publicAccountId); return item ? clone(item) : null; },
    async findAccountByPublicId(publicAccountId) { const item = [...accounts.values()].find((account) => account.publicAccountId === publicAccountId); return item ? clone(item) : null; },
    async createAccount(input) { accounts.set(input.id, clone(input)); return clone(input); },
    async updateAccount(companyId, id, patch) { const current = accounts.get(id); if (!current || current.companyId !== companyId) return null; const next = { ...current, ...clone(patch), id, companyId, updatedAt: new Date().toISOString() }; accounts.set(id, next); return clone(next); },
    async getOrder(companyId, orderId) { const item = ordersMap.get(`${companyId}:${orderId}`); return item ? clone(item) : null; },
    async findRequestByOrderReference(companyId, orderNo) { const order = [...ordersMap.values()].find((item) => item.companyId === companyId && item.orderNo === orderNo); if (!order) return null; const item = [...requests.values()].find((request) => request.companyId === companyId && request.orderId === order.id); return item ? clone(item) : null; },
    async createRequest(input) { requests.set(input.id, clone(input)); return clone(input); },
    async getRequest(companyId, requestId) { const item = requests.get(requestId); return item && item.companyId === companyId ? clone(item) : null; },
    async listRequestsForOrder(companyId, orderId) { return clone([...requests.values()].filter((request) => request.companyId === companyId && request.orderId === orderId)); },
    async updateRequest(companyId, requestId, patch) { const current = requests.get(requestId); if (!current || current.companyId !== companyId) return null; const next = { ...current, ...clone(patch), id: requestId, companyId, updatedAt: new Date().toISOString() }; requests.set(requestId, next); return clone(next); },
    async getRequestByTokenHash(tokenHash) { const item = [...requests.values()].find((request) => request.publicTokenHash === tokenHash); return item ? clone(item) : null; },
    async listAttempts(companyId, requestId) { return clone([...attempts.values()].filter((attempt) => attempt.companyId === companyId && attempt.requestId === requestId)); },
    async listAttemptsForOrder(companyId, orderId) { const requestIds = [...requests.values()].filter((request) => request.companyId === companyId && request.orderId === orderId).map((request) => request.id); return clone([...attempts.values()].filter((attempt) => attempt.companyId === companyId && requestIds.includes(attempt.requestId))); },
    async getAttempt(companyId, attemptId) { const item = attempts.get(attemptId); return item && item.companyId === companyId ? clone(item) : null; },
    async findAttemptByIdempotency(companyId, idempotencyKey) { const item = [...attempts.values()].find((attempt) => attempt.companyId === companyId && attempt.idempotencyKey === idempotencyKey); return item ? clone(item) : null; },
    async findAttemptByProviderTransaction(companyId, provider, providerTransactionId) { const item = [...attempts.values()].find((attempt) => attempt.companyId === companyId && attempt.provider === provider && attempt.providerTransactionId === providerTransactionId); return item ? clone(item) : null; },
    async createAttempt(input) { const existing = await repo.findAttemptByIdempotency(input.companyId, input.idempotencyKey); if (existing) return existing; attempts.set(input.id, clone(input)); return clone(input); },
    async updateAttempt(companyId, id, patch) { const current = attempts.get(id); if (!current || current.companyId !== companyId) return null; const next = { ...current, ...clone(patch), id, companyId, updatedAt: new Date().toISOString() }; attempts.set(id, next); return clone(next); },
    async recordProviderEvent(input) { const key = `${input.provider}:${input.providerEventId}`; const current = events.get(key); if (current) return { event: clone(current), created: false }; const event = { ...input, payloadHash: input.payloadHash, receivedAt: input.receivedAt, processedAt: input.processedAt }; events.set(key, clone(event)); return { event: clone(event), created: true }; },
    async markProviderEventProcessed(provider, providerEventId) { const key = `${provider}:${providerEventId}`; const current = events.get(key); if (!current) return null; const next = { ...current, processedAt: new Date().toISOString() }; events.set(key, next); return clone(next); },
    async createRefund(input) { const existing = [...refunds.values()].find((refund) => refund.companyId === input.companyId && refund.idempotencyKey === input.idempotencyKey); if (existing) return clone(existing); refunds.set(input.id, clone(input)); return clone(input); },
    async updateRefund(companyId, id, patch) { const current = refunds.get(id); if (!current || current.companyId !== companyId) return null; const next = { ...current, ...clone(patch), id, companyId, updatedAt: new Date().toISOString() }; refunds.set(id, next); return clone(next); },
    async listRefunds(companyId, requestId) { return clone([...refunds.values()].filter((refund) => refund.companyId === companyId && refund.requestId === requestId)); },
    async updateOrderPayment(companyId, orderId, paymentStatus, amountPaidMinor) { const current = ordersMap.get(`${companyId}:${orderId}`); if (current) ordersMap.set(`${companyId}:${orderId}`, { ...current, paymentStatus, amountPaidMinor }); },
  };
  return repo;
}

function iso(value: Date | null | undefined) { return value?.toISOString() || new Date(0).toISOString(); }
function mapAccount(row: typeof paymentAccounts.$inferSelect): PaymentAccount { return { id: row.id, companyId: row.companyId, provider: row.provider as PaymentProvider, displayName: row.displayName, publicAccountId: row.publicAccountId, encryptedCredentials: row.encryptedCredentials, credentialsConfigured: row.credentialsConfigured, status: row.status as PaymentAccount["status"], healthStatus: row.healthStatus as PaymentAccount["healthStatus"], lastError: row.lastError, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }; }
function mapRequest(row: typeof paymentRequests.$inferSelect): PaymentRequest { return { id: row.id, companyId: row.companyId, orderId: row.orderId, amountMinor: row.amountMinor, currency: row.currency, description: row.description, publicTokenHash: row.publicTokenHash, expiresAt: iso(row.expiresAt), status: row.status as PaymentRequestStatus, createdBy: row.createdBy, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }; }
function mapAttempt(row: typeof paymentAttempts.$inferSelect): PaymentAttempt & { paymentAccountId: string } { return { id: row.id, companyId: row.companyId, requestId: row.requestId, paymentAccountId: row.paymentAccountId, provider: row.provider as PaymentProvider, idempotencyKey: row.idempotencyKey, providerTransactionId: row.providerTransactionId, paymentUrl: row.paymentUrl, codeUrl: row.codeUrl, amountMinor: row.amountMinor, currency: row.currency, status: row.status as PaymentAttempt["status"], failureCode: row.failureCode, expiresAt: row.expiresAt?.toISOString() || null, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }; }
function mapEvent(row: typeof paymentProviderEvents.$inferSelect): PaymentProviderEvent { return { id: row.id, companyId: row.companyId, provider: row.provider as PaymentProvider, providerEventId: row.providerEventId, payloadHash: row.payloadHash, receivedAt: iso(row.receivedAt), processedAt: row.processedAt?.toISOString() || null }; }
function mapRefund(row: typeof paymentRefunds.$inferSelect): PaymentRefund { return { id: row.id, companyId: row.companyId, requestId: row.requestId, attemptId: row.attemptId, amountMinor: row.amountMinor, reason: row.reason, providerRefundId: row.providerRefundId, status: row.status as PaymentRefund["status"], idempotencyKey: row.idempotencyKey, createdBy: row.createdBy, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }; }

export function createPostgresPaymentRepository(db: Database): PaymentRepository {
  return {
    async listAccounts(companyId) { return (await db.select().from(paymentAccounts).where(eq(paymentAccounts.companyId, companyId)).orderBy(asc(paymentAccounts.displayName))).map(mapAccount); },
    async getAccountByPublicId(companyId, publicAccountId) { const [row] = await db.select().from(paymentAccounts).where(and(eq(paymentAccounts.companyId, companyId), eq(paymentAccounts.publicAccountId, publicAccountId))).limit(1); return row ? mapAccount(row) : null; },
    async findAccountByPublicId(publicAccountId) { const [row] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.publicAccountId, publicAccountId)).limit(1); return row ? mapAccount(row) : null; },
    async createAccount(input) { const [row] = await db.insert(paymentAccounts).values({ ...input, createdAt: new Date(input.createdAt), updatedAt: new Date(input.updatedAt) }).returning(); return mapAccount(row); },
    async updateAccount(companyId, id, patch) { const [row] = await db.update(paymentAccounts).set({ ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}), ...(patch.publicAccountId !== undefined ? { publicAccountId: patch.publicAccountId } : {}), ...(patch.encryptedCredentials !== undefined ? { encryptedCredentials: patch.encryptedCredentials } : {}), ...(patch.credentialsConfigured !== undefined ? { credentialsConfigured: patch.credentialsConfigured } : {}), ...(patch.status !== undefined ? { status: patch.status } : {}), ...(patch.healthStatus !== undefined ? { healthStatus: patch.healthStatus } : {}), ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}), updatedAt: new Date() }).where(and(eq(paymentAccounts.companyId, companyId), eq(paymentAccounts.id, id))).returning(); return row ? mapAccount(row) : null; },
    async getOrder(companyId, orderId) { const rows = await db.select({ order: orders, company: companies }).from(orders).innerJoin(companies, eq(orders.companyId, companies.id)).where(and(eq(orders.companyId, companyId), eq(orders.id, orderId))).limit(1); const row = rows[0]; if (!row) return null; return { id: row.order.id, companyId: row.order.companyId, orderNo: row.order.orderNo, totalAmount: row.order.totalAmount || "0", currency: row.order.currency || "USD", paymentStatus: row.order.paymentStatus as OrderPaymentStatus, amountPaidMinor: row.order.amountPaidMinor, merchantName: row.company.name }; },
    async findRequestByOrderReference(companyId, orderNo) { const rows = await db.select({ request: paymentRequests }).from(paymentRequests).innerJoin(orders, eq(paymentRequests.orderId, orders.id)).where(and(eq(paymentRequests.companyId, companyId), eq(orders.orderNo, orderNo))).limit(1); return rows[0] ? mapRequest(rows[0].request) : null; },
    async createRequest(input) { const [row] = await db.insert(paymentRequests).values({ ...input, expiresAt: new Date(input.expiresAt), createdAt: new Date(input.createdAt), updatedAt: new Date(input.updatedAt) }).returning(); return mapRequest(row); },
    async getRequest(companyId, requestId) { const [row] = await db.select().from(paymentRequests).where(and(eq(paymentRequests.companyId, companyId), eq(paymentRequests.id, requestId))).limit(1); return row ? mapRequest(row) : null; },
    async listRequestsForOrder(companyId, orderId) { return (await db.select().from(paymentRequests).where(and(eq(paymentRequests.companyId, companyId), eq(paymentRequests.orderId, orderId))).orderBy(desc(paymentRequests.createdAt))).map(mapRequest); },
    async updateRequest(companyId, requestId, patch) { const [row] = await db.update(paymentRequests).set({ ...(patch.status !== undefined ? { status: patch.status } : {}), ...(patch.expiresAt !== undefined ? { expiresAt: new Date(patch.expiresAt) } : {}), updatedAt: new Date() }).where(and(eq(paymentRequests.companyId, companyId), eq(paymentRequests.id, requestId))).returning(); return row ? mapRequest(row) : null; },
    async getRequestByTokenHash(tokenHash) { const [row] = await db.select().from(paymentRequests).where(eq(paymentRequests.publicTokenHash, tokenHash)).limit(1); return row ? mapRequest(row) : null; },
    async listAttempts(companyId, requestId) { return (await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.companyId, companyId), eq(paymentAttempts.requestId, requestId))).orderBy(desc(paymentAttempts.createdAt))).map(mapAttempt); },
    async listAttemptsForOrder(companyId, orderId) { const rows = await db.select({ attempt: paymentAttempts }).from(paymentAttempts).innerJoin(paymentRequests, eq(paymentAttempts.requestId, paymentRequests.id)).where(and(eq(paymentAttempts.companyId, companyId), eq(paymentRequests.orderId, orderId))).orderBy(desc(paymentAttempts.createdAt)); return rows.map((row) => mapAttempt(row.attempt)); },
    async getAttempt(companyId, attemptId) { const [row] = await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.companyId, companyId), eq(paymentAttempts.id, attemptId))).limit(1); return row ? mapAttempt(row) : null; },
    async findAttemptByIdempotency(companyId, idempotencyKey) { const [row] = await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.companyId, companyId), eq(paymentAttempts.idempotencyKey, idempotencyKey))).limit(1); return row ? mapAttempt(row) : null; },
    async findAttemptByProviderTransaction(companyId, provider, providerTransactionId) { const [row] = await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.companyId, companyId), eq(paymentAttempts.provider, provider), eq(paymentAttempts.providerTransactionId, providerTransactionId))).limit(1); return row ? mapAttempt(row) : null; },
    async createAttempt(input) { const [row] = await db.insert(paymentAttempts).values({ ...input, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, createdAt: new Date(input.createdAt), updatedAt: new Date(input.updatedAt) }).onConflictDoNothing({ target: [paymentAttempts.companyId, paymentAttempts.idempotencyKey] }).returning(); if (row) return mapAttempt(row); const existing = await this.findAttemptByIdempotency(input.companyId, input.idempotencyKey); if (!existing) throw new BusinessError("CONFLICT", "Payment attempt conflict", 409); return existing; },
    async updateAttempt(companyId, id, patch) { const [row] = await db.update(paymentAttempts).set({ ...(patch.providerTransactionId !== undefined ? { providerTransactionId: patch.providerTransactionId } : {}), ...(patch.paymentUrl !== undefined ? { paymentUrl: patch.paymentUrl } : {}), ...(patch.codeUrl !== undefined ? { codeUrl: patch.codeUrl } : {}), ...(patch.status !== undefined ? { status: patch.status } : {}), ...(patch.failureCode !== undefined ? { failureCode: patch.failureCode } : {}), ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt ? new Date(patch.expiresAt) : null } : {}), updatedAt: new Date() }).where(and(eq(paymentAttempts.companyId, companyId), eq(paymentAttempts.id, id))).returning(); return row ? mapAttempt(row) : null; },
    async recordProviderEvent(input) { const [row] = await db.insert(paymentProviderEvents).values({ ...input, payload: input.payload || {}, receivedAt: new Date(input.receivedAt), processedAt: input.processedAt ? new Date(input.processedAt) : null }).onConflictDoNothing({ target: [paymentProviderEvents.provider, paymentProviderEvents.providerEventId] }).returning(); if (row) return { event: mapEvent(row), created: true }; const [existing] = await db.select().from(paymentProviderEvents).where(and(eq(paymentProviderEvents.provider, input.provider), eq(paymentProviderEvents.providerEventId, input.providerEventId))).limit(1); if (!existing) throw new BusinessError("CONFLICT", "Payment event conflict", 409); return { event: mapEvent(existing), created: false }; },
    async markProviderEventProcessed(provider, providerEventId) { const [row] = await db.update(paymentProviderEvents).set({ processedAt: new Date() }).where(and(eq(paymentProviderEvents.provider, provider), eq(paymentProviderEvents.providerEventId, providerEventId))).returning(); return row ? mapEvent(row) : null; },
    async createRefund(input) { const [row] = await db.insert(paymentRefunds).values({ ...input, createdAt: new Date(input.createdAt), updatedAt: new Date(input.updatedAt) }).onConflictDoNothing({ target: [paymentRefunds.companyId, paymentRefunds.idempotencyKey] }).returning(); if (row) return mapRefund(row); const [existing] = await db.select().from(paymentRefunds).where(and(eq(paymentRefunds.companyId, input.companyId), eq(paymentRefunds.idempotencyKey, input.idempotencyKey))).limit(1); if (!existing) throw new BusinessError("CONFLICT", "Payment refund conflict", 409); return mapRefund(existing); },
    async updateRefund(companyId, id, patch) { const [row] = await db.update(paymentRefunds).set({ ...(patch.providerRefundId !== undefined ? { providerRefundId: patch.providerRefundId } : {}), ...(patch.status !== undefined ? { status: patch.status } : {}), updatedAt: new Date() }).where(and(eq(paymentRefunds.companyId, companyId), eq(paymentRefunds.id, id))).returning(); return row ? mapRefund(row) : null; },
    async listRefunds(companyId, requestId) { return (await db.select().from(paymentRefunds).where(and(eq(paymentRefunds.companyId, companyId), eq(paymentRefunds.requestId, requestId))).orderBy(asc(paymentRefunds.createdAt))).map(mapRefund); },
    async updateOrderPayment(companyId, orderId, paymentStatus, amountPaidMinor) { await db.update(orders).set({ paymentStatus, amountPaidMinor, updatedAt: new Date() }).where(and(eq(orders.companyId, companyId), eq(orders.id, orderId))); },
  };
}

export function hashPublicToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { getPool, closeDbPool, transaction, DatabaseUnavailableError } from "../../src/db";
import { applyMigrations, readMigrationFiles, validateAppliedMigrations } from "../../scripts/database/migrations.mjs";
import { bootstrapOwner } from "../../scripts/database/bootstrap.mjs";
import { CrmRepository, CrmError } from "../../src/lib/crm-repository";
import { runInWorkspace } from "../../src/lib/workspace-context";
import { createSaasWorkspace, updateSaasWorkspace, listSaasWorkspaces } from "../../src/lib/saas";
import { createWorkspaceMember, updateWorkspaceMember, resetWorkspaceMemberPassword, listWorkspaceMembers, TeamError, type TeamActor } from "../../src/lib/team";
import { changeAccountPassword, getAuthSessionState, updateAccountProfile } from "../../src/lib/account";
import { verifyPassword } from "../../src/lib/crypto";
import { ProspectingRepository } from "../../src/lib/prospecting-repository";
import { getSchema, updateSchema, getWorkflow, updateWorkflow } from "../../src/lib/custom-fields/store";
import { readDatabaseStatus } from "../../src/lib/database-status";
import type { StoredQuotation, StoredProductVideoJob } from "../../src/lib/store";
import { GET as getContact, PATCH as patchContact, DELETE as deleteContact } from "../../src/app/api/contacts/[id]/route";
import { GET as exportContacts } from "../../src/app/api/contacts/export/route";
import { POST as createOrder } from "../../src/app/api/orders/route";
import { POST as createShipment } from "../../src/app/api/shipments/route";
import { POST as generateDocuments } from "../../src/app/api/documents/generate/route";
import { GET as getEmails, POST as saveDraft, PATCH as patchEmail } from "../../src/app/api/email/route";

// Deliberately no DATABASE_URL fallback: integration tests must never migrate a
// developer's live DB. Use an explicit, loopback-only, disposable *_test DB.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required; use a separate local *_test database");
const parsedUrl = new URL(testUrl);
if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname) || !/^\/[a-zA-Z0-9_-]+_test$/.test(parsedUrl.pathname)) {
  throw new Error("Refusing integration tests outside a loopback *_test database");
}
process.env.DATABASE_URL = testUrl;
process.env.PGSSLMODE = "disable";
const prefix = `audit-${randomUUID().slice(0, 8)}`;
const platform: TeamActor = { id: "integration-platform", role: "owner", isPlatformAdmin: true };
const workspaceIds = new Set<string>();
type Fixture = { id: string; actor: TeamActor; repo: CrmRepository; ownerId: string; ownerEmail: string };
let a: Fixture;
let b: Fixture;
const password = `Integration-${randomUUID()}`;

async function fixture(suffix: string, limit = 20): Promise<Fixture> {
  const created = await createSaasWorkspace(platform, {
    name: `Integration ${suffix}`, slug: `${prefix}-${suffix}`, memberLimit: limit,
    ownerName: "Test Owner", ownerEmail: `${prefix}-${suffix}@example.test`,
  });
  workspaceIds.add(created.workspace.id);
  await changeAccountPassword(created.owner.id, created.temporaryPassword, password);
  return { id: created.workspace.id, ownerId: created.owner.id, ownerEmail: created.owner.email,
    actor: { id: created.owner.id, companyId: created.workspace.id, role: "owner" },
    repo: new CrmRepository(created.workspace.id, created.owner.id, { role: "owner" }) };
}
function inWorkspace<T>(f: Fixture, fn: () => T, actor = f.actor): T {
  return runInWorkspace({ companyId: f.id, userId: actor.id, role: actor.role || "member", isPlatformAdmin: actor.isPlatformAdmin === true, store: new CrmRepository(f.id, actor.id, { role: actor.role || "member" }) }, fn);
}
function request(path: string, body: unknown, method = "POST") {
  return new Request(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as never;
}
const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });
async function version(id: string) {
  const result = await getPool().query("SELECT settings->>'sessionVersion' AS version FROM users WHERE id=$1", [id]);
  return result.rows[0].version as string;
}
const denied = (status: number) => (error: unknown) => (error instanceof TeamError || error instanceof CrmError) && error.status === status;

before(async () => {
  await closeDbPool();
  await Promise.all([applyMigrations(getPool()), applyMigrations(getPool())]);
  a = await fixture("a"); b = await fixture("b");
});
after(async () => {
  await closeDbPool(); process.env.DATABASE_URL = testUrl;
  // Delete ONLY this run's explicitly tracked fixtures, never TRUNCATE or wipe
  // another test run/tenant. Links must be removed before their target records.
  const ids = [...workspaceIds];
  if (ids.length) await transaction(async client => {
    for (const table of ["crm_record_links", "crm_records", "crm_counters", "audit_events", "users"]) {
      await client.query(`DELETE FROM ${table} WHERE company_id=ANY($1::uuid[])`, [ids]);
    }
    await client.query("DELETE FROM companies WHERE id=ANY($1::uuid[]) AND slug LIKE $2", [ids, `${prefix}-%`]);
  });
  await closeDbPool();
});

test("real PG: concurrent/rerun migrations match checksums; mutated/gapped histories are refused", async () => {
  const files = await readMigrationFiles();
  const beforeRows = (await getPool().query("SELECT version,checksum,applied_at FROM tradepilot_migrations ORDER BY version")).rows;
  assert.equal(beforeRows.length, files.length);
  await applyMigrations(getPool());
  assert.deepEqual((await getPool().query("SELECT version,checksum,applied_at FROM tradepilot_migrations ORDER BY version")).rows, beforeRows);
  assert.throws(() => validateAppliedMigrations(files, [{ ...beforeRows[0], checksum: "0".repeat(64) }]), /modified/);
  assert.throws(() => validateAppliedMigrations(files, [beforeRows[1]]), /contiguous/);
  assert.throws(() => validateAppliedMigrations(files, [{ version: "9999_unknown.sql", checksum: "0".repeat(64) }]), /Unknown/);
});

test("real PG: same record ID is independent; foreign get/patch/delete/export cannot access A", async () => {
  for (const f of [a, b]) await f.repo.contacts.add({ id: "shared-id", name: `${prefix}-${f === a ? "A" : "B"}-private`, createdAt: "2026-10-07" });
  assert.notEqual((await a.repo.contacts.get("shared-id"))?.name, (await b.repo.contacts.get("shared-id"))?.name);
  await a.repo.contacts.add({ id: "only-a", name: `${prefix}-only-a-private`, createdAt: "2026-10-07" });
  for (const response of await inWorkspace(b, () => Promise.all([
    getContact(new Request("http://localhost/api/contacts/only-a"), routeParams("only-a")),
    patchContact(request("/api/contacts/only-a", { name: "tamper" }, "PATCH"), routeParams("only-a")),
    deleteContact(new Request("http://localhost/api/contacts/only-a", { method: "DELETE" }), routeParams("only-a")),
  ]))) assert.equal(response.status, 404);
  const csv = await inWorkspace(b, () => exportContacts());
  assert.doesNotMatch(await csv.text(), new RegExp(`${prefix}-A-private|${prefix}-only-a-private`));
  await b.repo.contacts.update("shared-id", { name: "B updated", id: "tampered-id" });
  assert.equal((await b.repo.contacts.get("shared-id"))?.id, "shared-id");
  assert.equal((await a.repo.contacts.get("shared-id"))?.name, `${prefix}-A-private`);
  assert.equal(await b.repo.contacts.delete("shared-id"), true);
  assert.ok(await a.repo.contacts.get("shared-id"));
});

test("real PG: repository and composite foreign key reject cross-tenant references", async () => {
  await assert.rejects(b.repo.inquiries.add({ id: "foreign-inquiry", contactId: "only-a", customer: "Foreign", subject: "Product", content: "Test inquiry", source: "manual", status: "pending", createdAt: "2026-10-07" }), denied(404));
  await b.repo.contacts.add({ id: "fk-source", name: "B source", createdAt: "2026-10-07" });
  await assert.rejects(getPool().query("INSERT INTO crm_record_links(company_id,source_kind,source_id,target_kind,target_id) VALUES($1,'contacts','fk-source','contacts','only-a')", [b.id]), (error: unknown) => (error as { code?: string }).code === "23503");
  assert.equal(await b.repo.inquiries.get("foreign-inquiry"), undefined);
});

test("real PG: concurrent counters across repository instances are unique and tenant-scoped", async () => {
  const numbers = await Promise.all(Array.from({ length: 20 }, () => new CrmRepository(a.id, a.ownerId).quotations.nextNo()));
  assert.equal(new Set(numbers).size, 20);
  assert.match(await b.repo.quotations.nextNo(), /-001$/);
});

test("real PG: concurrent quote→order→shipment and document retries stay unique", async () => {
  const quotation: StoredQuotation = { id: "accepted-quote", no: "QTN-INTEGRATION", contactId: "only-a", contactName: "A customer",
    items: [{ productName: "Test Product", quantity: 10, unit: "pcs", unitPrice: 12, amount: 120 }], totalAmount: 120,
    currency: "USD", tradeTerm: "FOB", status: "accepted", aiGenerated: false, createdAt: "2026-10-07" };
  await a.repo.quotations.add(quotation);
  const responses = await inWorkspace(a, () => Promise.all(Array.from({ length: 4 }, () => createOrder(request("/api/orders", { quotationId: quotation.id, deliveryDate: "2026-11-01" })))));
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409, 409, 409]);
  const order = await responses.find(r => r.status === 201)!.json();
  assert.equal((await a.repo.orders.list()).filter(o => o.quotationId === quotation.id).length, 1);
  const shipments = await inWorkspace(a, () => Promise.all(Array.from({ length: 3 }, () => createShipment(request("/api/shipments", { orderId: order.id, carrier: "Test Carrier", referenceNo: "TEST-001", method: "sea", etd: "2026-11-01", eta: "2026-11-10" })))));
  assert.deepEqual(shipments.map(r => r.status).sort(), [201, 409, 409]);
  const docs = await inWorkspace(a, () => Promise.all(Array.from({ length: 4 }, () => generateDocuments(request("/api/documents/generate", { orderId: order.id })))));
  assert.ok(docs.every(r => r.status === 200));
  const bodies = await Promise.all(docs.map(r => r.json()));
  assert.equal(bodies.reduce((total, body) => total + body.createdCount, 0), bodies[0].count);
  assert.equal((await a.repo.documents.byOrder(order.id)).length, bodies[0].count);
  const foreign = await inWorkspace(b, () => generateDocuments(request("/api/documents/generate", { orderId: order.id })));
  assert.equal(foreign.status, 404);
});

test("real PG: prospect source dedupe, distributed cooldown and promotion are workspace-scoped", async () => {
  const prospectA = new ProspectingRepository(a.repo); const prospectB = new ProspectingRepository(b.repo);
  const persona = await prospectA.persona({ name: "灯具供应商", business: "LED lighting", audience: "lighting wholesale" });
  const taskInput = { personaId: persona.id, name: "海外采购", keywords: ["lighting", "wholesale"], source: "公开网页" };
  const firstTask = await prospectA.task(taskInput); const secondTask = await prospectA.task({ ...taskInput, name: "另一个任务" });
  const lead = await prospectA.lead({ taskId: firstTask.id, name: "Lighting wholesale", sourceUrl: "https://example.test/buyer?utm_source=test#about", excerpt: "lighting wholesale buyer", email: "buyer@example.test" }, true);
  await assert.rejects(prospectA.lead({ taskId: secondTask.id, name: "Duplicate", sourceUrl: "https://example.test/buyer", excerpt: "lighting wholesale buyer" }), denied(409));
  const runs = await Promise.allSettled([prospectA.beginRun(firstTask.id), new ProspectingRepository(new CrmRepository(a.id, a.ownerId)).beginRun(firstTask.id)]);
  assert.equal(runs.filter(r => r.status === "fulfilled").length, 1);
  const rejected = runs.find(r => r.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.status, 429);
  await assert.rejects(prospectB.patch({ id: lead.id, status: "qualified" }), denied(404));
  await assert.rejects(prospectB.promote(lead.id), denied(404));
  const promoted = await prospectA.promote(lead.id);
  assert.ok(await a.repo.contacts.get(promoted.contactId!));
  assert.equal(await b.repo.contacts.get(promoted.contactId!), undefined);
  await assert.rejects(prospectA.promote(lead.id), denied(409));
  const bPersona = await prospectB.persona({ name: "B", business: "lighting", audience: "wholesale" });
  const bTask = await prospectB.task({ ...taskInput, personaId: bPersona.id });
  assert.ok(await prospectB.lead({ taskId: bTask.id, name: "Independent", sourceUrl: "https://example.test/buyer", excerpt: "wholesale lighting" }));
});

test("real PG: owner/admin/member authorization and tenant IDOR management matrix", async () => {
  const admin = await createWorkspaceMember(a.actor, { name: "Admin", email: `${prefix}-admin@example.test`, role: "admin" });
  await changeAccountPassword(admin.user.id, admin.temporaryPassword, password);
  const adminActor = { id: admin.user.id, companyId: a.id, role: "admin" };
  const member = await createWorkspaceMember(adminActor, { name: "Member", email: `${prefix}-member@example.test` });
  await changeAccountPassword(member.user.id, member.temporaryPassword, password);
  await assert.rejects(createWorkspaceMember(adminActor, { name: "No", email: `${prefix}-no@example.test`, role: "admin" }), denied(403));
  await assert.rejects(updateWorkspaceMember(adminActor, { id: a.ownerId, isActive: false }), denied(409));
  await assert.rejects(resetWorkspaceMemberPassword(adminActor, admin.user.id), denied(409));
  await assert.rejects(updateWorkspaceMember(a.actor, { id: b.ownerId, isActive: false }), denied(404));
  const memberActor = { id: member.user.id, companyId: a.id, role: "member" };
  await assert.rejects(listWorkspaceMembers(memberActor), denied(403));
  await assert.rejects(createSaasWorkspace({ ...a.actor, isPlatformAdmin: false }, { name: "No", slug: `${prefix}-unauthorized`, memberLimit: 10, ownerName: "No", ownerEmail: `${prefix}-no@example.test` }), denied(403));
  // A stale JWT claiming 'admin' must not survive an authoritative demotion.
  await updateWorkspaceMember(a.actor, { id: admin.user.id, role: "member" });
  await assert.rejects(listWorkspaceMembers(adminActor), denied(403));
  assert.ok((await listWorkspaceMembers(a.actor)).members.every(m => m.id !== b.ownerId));
  assert.ok((await listSaasWorkspaces(platform)).workspaces.some(w => w.id === a.id));
});

test("real PG: simultaneous creation respects quota including owner; failed transaction has no audit/user", async () => {
  const limited = await fixture("quota", 2);
  const results = await Promise.allSettled(["one", "two"].map(suffix => createWorkspaceMember(limited.actor, { name: suffix, email: `${prefix}-quota-${suffix}@example.test` })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const failure = results.find(r => r.status === "rejected") as PromiseRejectedResult;
  assert.equal(failure.reason.status, 409);
  const members = await listWorkspaceMembers(limited.actor);
  assert.equal(members.activeMemberCount, 2);
  const audit = await getPool().query("SELECT count(*)::int AS count FROM audit_events WHERE company_id=$1 AND action='team.member.create'", [limited.id]);
  assert.equal(audit.rows[0].count, 1);
  await assert.rejects(updateSaasWorkspace(platform, { id: limited.id, memberLimit: 1 }), denied(409));
});

test("real PG: password reset, role/status and workspace disable/re-enable revoke sessions permanently", async () => {
  const f = await fixture("sessions");
  const member = await createWorkspaceMember(f.actor, { name: "Session User", email: `${prefix}-session@example.test` });
  const userId = member.user.id;
  const tempVersion = await version(userId);
  assert.equal((await getAuthSessionState(userId, tempVersion)).mustChangePassword, true);
  await assert.rejects(new CrmRepository(f.id, userId).contacts.add({ id: "blocked-temp", name: "No", createdAt: "2026-10-07" }), denied(403));
  await changeAccountPassword(userId, member.temporaryPassword, password);
  assert.equal((await getAuthSessionState(userId, tempVersion)).active, false);
  const old = await version(userId);
  assert.equal((await getAuthSessionState(userId, old)).active, true);
  await resetWorkspaceMemberPassword(f.actor, userId);
  assert.equal((await getAuthSessionState(userId, old)).active, false);
  const reset = await resetWorkspaceMemberPassword(f.actor, userId);
  await changeAccountPassword(userId, reset.temporaryPassword, password);
  const roleVersion = await version(userId);
  await updateWorkspaceMember(f.actor, { id: userId, role: "admin" });
  assert.equal((await getAuthSessionState(userId, roleVersion)).active, false);
  const statusVersion = await version(userId);
  await updateWorkspaceMember(f.actor, { id: userId, isActive: false });
  await updateWorkspaceMember(f.actor, { id: userId, isActive: true });
  assert.equal((await getAuthSessionState(userId, statusVersion)).active, false);
  const enabledVersion = await version(userId);
  await updateSaasWorkspace(platform, { id: f.id, isActive: false });
  await assert.rejects(new CrmRepository(f.id, userId).contacts.add({ id: "blocked-workspace", name: "No", createdAt: "2026-10-07" }), denied(403));
  await updateSaasWorkspace(platform, { id: f.id, isActive: true });
  assert.equal((await getAuthSessionState(userId, enabledVersion)).active, false);
  assert.equal((await getAuthSessionState(userId, await version(userId))).active, true);
});

test("real PG: concurrent profile/password writes preserve hash/preferences and audit atomically", async () => {
  const member = await createWorkspaceMember(a.actor, { name: "Profile", email: `${prefix}-profile@example.test` });
  await Promise.all([
    updateAccountProfile(member.user.id, { name: "Profile Updated", locale: "en", timezone: "UTC" }),
    changeAccountPassword(member.user.id, member.temporaryPassword, password),
  ]);
  const row = (await getPool().query("SELECT name,settings FROM users WHERE id=$1", [member.user.id])).rows[0];
  assert.equal(row.name, "Profile Updated"); assert.equal(row.settings.locale, "en");
  assert.equal(row.settings.mustChangePassword, false);
  assert.ok(await verifyPassword(password, row.settings.passwordHash));
  const audits = (await getPool().query("SELECT action FROM audit_events WHERE company_id=$1 AND target_id=$2 AND action LIKE 'account.%'", [a.id, member.user.id])).rows;
  assert.equal(audits.length, 2);
});

test("real PG: mail drafts, video metadata, field/workflow persist after pool reconnect without leaking", async () => {
  const draftResponse = await inWorkspace(a, () => saveDraft(request("/api/email", { action: "save-draft", to: "buyer@example.test", subject: "Private draft", body: "Not SMTP delivery" })));
  assert.equal(draftResponse.status, 201);
  const draft = (await draftResponse.json()).email;
  const foreignPatch = await inWorkspace(b, () => patchEmail(request("/api/email", { id: draft.id, isRead: false }, "PATCH")));
  assert.equal(foreignPatch.status, 404);
  const noSMTP = await inWorkspace(a, () => saveDraft(request("/api/email", { action: "send", to: "buyer@example.test" })));
  assert.equal(noSMTP.status, 400); // Invalid send input is now a business 400, not a generic 503.
  await a.repo.products.add({ id: "video-product", name: "Product", unit: "pcs" });
  const now = new Date().toISOString();
  const video: StoredProductVideoJob = { id: "private-video", productId: "video-product", productName: "Product", title: "Private metadata", style: "clean", language: "zh", duration: 15, aspectRatio: "16:9", status: "queued", progress: 0, engine: "local", workerMode: "mock", sourceImages: [], brief: "Metadata test only", createdAt: now, updatedAt: now };
  await a.repo.productVideoJobs.add(video);
  await inWorkspace(a, () => updateSchema("contact", { label: "Private fields", fields: [{ id: "private-field", key: "private", name: "Private", type: "text", order: 1 }] }));
  await inWorkspace(a, async () => updateWorkflow({ ...await getWorkflow(), name: "Private workflow" }));
  await closeDbPool();
  assert.equal((await a.repo.productVideoJobs.get(video.id))?.title, video.title);
  assert.equal(await b.repo.productVideoJobs.get(video.id), undefined);
  const persistedMail = await inWorkspace(a, () => getEmails(new Request("http://localhost/api/email?folder=draft")));
  assert.ok((await persistedMail.json()).emails.some((email: { id: string }) => email.id === draft.id));
  const otherMail = await inWorkspace(b, () => getEmails(new Request("http://localhost/api/email?folder=draft")));
  assert.equal((await otherMail.json()).emails.length, 0);
  assert.equal((await inWorkspace(a, () => getSchema("contact"))).label, "Private fields");
  assert.notEqual((await inWorkspace(b, () => getSchema("contact"))).label, "Private fields");
  assert.equal((await inWorkspace(a, () => getWorkflow())).name, "Private workflow");
  assert.notEqual((await inWorkspace(b, () => getWorkflow())).name, "Private workflow");
});

test("real PG: custom-field authorization is rechecked inside the workspace write lock", async () => {
  const member = await createWorkspaceMember(a.actor, { name: "Former Admin", email: `${prefix}-former-admin@example.test`, role: "admin" });
  await changeAccountPassword(member.user.id, member.temporaryPassword, password);
  await updateWorkspaceMember(a.actor, { id: member.user.id, role: "member" });
  const staleActor = { id: member.user.id, companyId: a.id, role: "admin" };
  await assert.rejects(inWorkspace(a, () => updateSchema("contact", { label: "Stale override" }), staleActor), denied(403));
  assert.equal((await inWorkspace(a, () => getSchema("contact"))).label, "Private fields");
});

test("real PG: DB outage fails closed with 503; no in-memory success or fallback data", async () => {
  await closeDbPool();
  const broken = new URL(testUrl); broken.port = "1";
  process.env.DATABASE_URL = broken.toString();
  try {
    const response = await inWorkspace(a, () => getContact(new Request("http://localhost/api/contacts/only-a"), routeParams("only-a")));
    assert.equal(response.status, 503);
    await assert.rejects(a.repo.contacts.list(), DatabaseUnavailableError);
    const session = await getAuthSessionState(a.ownerId, awaitSavedVersion);
    assert.equal(session.active, false); assert.equal(session.databaseUnavailable, true);
  } finally { await closeDbPool(); process.env.DATABASE_URL = testUrl; }
  assert.ok(await a.repo.contacts.get("only-a"));
});
// An arbitrary previous version suffices: outage must be distinct from a real
// revocation even when the caller cannot fetch its authoritative version.
const awaitSavedVersion = "pre-outage-version";

test("real PG: bootstrap reruns preserve disabled accounts/preferences; explicit reset is narrow", async () => {
  const f = await fixture("bootstrap");
  await getPool().query("UPDATE users SET name='Retained',is_active=false,settings=settings || '{\"locale\":\"en\",\"timezone\":\"UTC\"}'::jsonb WHERE id=$1", [f.ownerId]);
  await getPool().query("UPDATE companies SET is_active=false WHERE id=$1", [f.id]);
  const original = (await getPool().query("SELECT name,is_active,settings FROM users WHERE id=$1", [f.ownerId])).rows[0];
  const input = { companyName: "Do not overwrite", companySlug: `${prefix}-bootstrap`, email: f.ownerEmail, name: "Do not overwrite", password: "Different-Password-123" };
  const results = await Promise.all([transaction(client => bootstrapOwner(client, input)), transaction(client => bootstrapOwner(client, input))]);
  assert.ok(results.every(result => !result.created && !result.passwordReset));
  assert.deepEqual((await getPool().query("SELECT name,is_active,settings FROM users WHERE id=$1", [f.ownerId])).rows[0], original);
  await transaction(client => bootstrapOwner(client, { ...input, resetPassword: true }));
  const reset = (await getPool().query("SELECT name,is_active,settings FROM users WHERE id=$1", [f.ownerId])).rows[0];
  assert.equal(reset.name, original.name); assert.equal(reset.is_active, false);
  assert.equal(reset.settings.locale, "en"); assert.equal(reset.settings.timezone, "UTC");
  assert.notEqual(reset.settings.sessionVersion, original.settings.sessionVersion);
  assert.ok(await verifyPassword(input.password, reset.settings.passwordHash));
  assert.equal((await getPool().query("SELECT is_active FROM companies WHERE id=$1", [f.id])).rows[0].is_active, false);
  const existingMember = await createWorkspaceMember(a.actor, { name: "Keep role", email: `${prefix}-keep-role@example.test` });
  await assert.rejects(transaction(client => bootstrapOwner(client, { ...input, companySlug: `${prefix}-a`, email: existingMember.user.email })), /refusing to move or promote/);
  await assert.rejects(transaction(client => bootstrapOwner(client, { ...input, companySlug: `${prefix}-a`, email: b.ownerEmail })), /refusing to move or promote/);
});

test("real PG: account constraints reject invalid roles/settings/email; diagnostics expose no payload/secret", async () => {
  for (const statement of ["UPDATE users SET role='platform-admin' WHERE id=$1", "UPDATE users SET settings='[]'::jsonb WHERE id=$1", "UPDATE users SET email='UPPER@example.test' WHERE id=$1", "UPDATE users SET settings=settings || '{\"mustChangePassword\":\"false\"}'::jsonb WHERE id=$1"]) {
    await assert.rejects(getPool().query(statement, [a.ownerId]), (error: unknown) => (error as { code?: string }).code === "23514");
  }
  const status = await readDatabaseStatus();
  assert.equal(status.state, "ready"); assert.equal(status.schemaReady, true);
  assert.equal(status.latestMigration, (await readMigrationFiles()).at(-1)?.version);
  assert.ok(status.totals && status.totals.workspaces >= 2);
  const serialized = JSON.stringify(status);
  assert.doesNotMatch(serialized, /passwordHash|Private draft|only-a-private|postgres:\/\//);
  assert.ok(status.migrations.every(migration => migration.state === "applied"));
});

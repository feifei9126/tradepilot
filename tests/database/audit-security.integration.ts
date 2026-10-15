import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { NextRequest } from "next/server";
import { configureTestDatabase } from "../helpers/test-database";
import { getPool, closeDbPool, transaction } from "../../src/db";
import { applyMigrations } from "../../scripts/database/migrations.mjs";
import { createSaasWorkspace } from "../../src/lib/saas";
import { createWorkspaceMember, type TeamActor } from "../../src/lib/team";
import { changeAccountPassword } from "../../src/lib/account";
import { CrmRepository } from "../../src/lib/crm-repository";
import { runInWorkspace } from "../../src/lib/workspace-context";
import { reserveLoginAttempt, finishLoginAttempt } from "../../src/lib/login-security";
import { getTenantDiscoverySettings, saveTenantDiscoverySettings, reserveTenantDiscovery, searchTenantPublicPages } from "../../src/lib/tenant-discovery";
import { POST as compatPreview } from "../../src/app/api/products/import/route";
import { POST as canonicalPreview } from "../../src/app/api/firecrawl/preview/route";
import { POST as emailSend } from "../../src/app/api/email/route";
import { POST as emailAccountSave } from "../../src/app/api/email/accounts/route";
import { GET as subscribeGET } from "../../src/app/api/email/subscribe/route";
import { GET as unsubscribeGET } from "../../src/app/api/email/unsubscribe/route";
import { saveEmailCredentials } from "../../src/lib/email/credentials";
import { assertMarketingRecipientsAllowed, confirmMarketingConsent, createUnsubscribeToken, isSuppressed, recordMarketingConsent, setSuppression } from "../../src/lib/email/compliance";
import { requestMarketingOptIn } from "../../src/lib/email/opt-in";
import { createMediaAsset, getMediaAsset } from "../../src/lib/media-assets";
import { GET as mediaGET, HEAD as mediaHEAD } from "../../src/app/api/media/[id]/route";
import { putObject, signedObjectUrl } from "../../src/lib/object-storage";
import { mediaDeliveryPolicy } from "../../src/lib/media-content";
import { saveTenantAISettings, reserveTenantAIRequest, finishTenantAIRequest } from "../../src/lib/tenant-ai";
import { GET as consentLinkGET } from "../../src/app/api/email/consent/route";
import { GET as aiStatusGET } from "../../src/app/api/api-config/status/route";
import { getEffectiveEntitlements } from "../../src/lib/billing/entitlements";
import { getBillingSummary, handleStripeEvent } from "../../src/lib/billing";

const originalEnv = { ...process.env };
const testUrl = configureTestDatabase();
const prefix = `p1-${randomUUID().slice(0, 8)}`;
const ids = new Set<string>(), loginKeys = new Set<string>(), eventIds = new Set<string>();
const platform: TeamActor = { id: "test-platform", isPlatformAdmin: true, role: "owner" };
type Fixture = { id: string; ownerId: string; actor: TeamActor; repo: CrmRepository };
const password = `Audit-${randomUUID()}`;
const planId = `${prefix}-paid`, smallPlanId = `${prefix}-minimal`, priceId = `price_${prefix.replaceAll("-", "")}Main`;
let mediaDir: string;
let fixtureCounter = 0;
const failStatus = (status: number) => (error: unknown) => Boolean(error && typeof error === "object" && "status" in error && error.status === status);
async function fixture(): Promise<Fixture> {
  const created = await createSaasWorkspace(platform, { name: "P1 audit", slug: `${prefix}-${fixtureCounter++}`, memberLimit: 20, ownerName: "Owner", ownerEmail: `${prefix}-${fixtureCounter}@example.test` });
  ids.add(created.workspace.id);
  await changeAccountPassword(created.owner.id, created.temporaryPassword, password);
  const actor: TeamActor = { id: created.owner.id, companyId: created.workspace.id, role: "owner" };
  return { id: created.workspace.id, ownerId: created.owner.id, actor, repo: new CrmRepository(created.workspace.id, created.owner.id, { role: "owner" }) };
}
function inWorkspace<T>(f: Fixture, fn: () => T, actor = f.actor): T {
  return runInWorkspace({ companyId: f.id, userId: actor.id, role: actor.role || "member", isPlatformAdmin: actor.isPlatformAdmin === true, store: new CrmRepository(f.id, actor.id, { role: actor.role || "member" }) }, fn);
}
function request(path: string, body: unknown) { return new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
const params = (id: string) => ({ params: Promise.resolve({ id }) });
function loginRequest(ip: string) { return new Request("http://localhost/api/auth/callback/credentials", { headers: { "x-real-ip": ip, "x-tradepilot-proxy-auth": process.env.TRADEPILOT_PROXY_AUTH_SECRET! } }); }
async function account(f: Fixture) {
  const now = new Date().toISOString();
  const data = { id: "mail", name: "Audit Mail", email: "sender@example.test", username: "sender@example.test", smtpHost: "smtp.example.test", smtpPort: 465, smtpSecure: true, imapHost: "imap.example.test", imapPort: 993, imapSecure: true, syncEnabled: false, createdAt: now };
  await f.repo.emailAccounts.add(data);
  await saveEmailCredentials(f.id, data.id, { smtpPassword: "audit-placeholder", smtpUsername: data.email });
  return data;
}
async function challenge(f: Fixture, email: string) {
  let link = "";
  const result = await requestMarketingOptIn(f.id, email, async (_company, _account, recipient, url) => { assert.equal(recipient, email); link = url; });
  assert.ok(!JSON.stringify(result).includes("token="));
  return { token: new URL(link).searchParams.get("token")!, link };
}
async function ai(f: Fixture, requestBudget = 1000, tokens = 1000000) {
  await saveTenantAISettings(f.id, f.ownerId, { provider: "openai", model: "audit-model", apiKey: `${prefix}-ai-key`, enabled: true, monthlyRequestLimit: requestBudget, monthlyTokenLimit: tokens });
}
async function subscription(f: Fixture, status = "active", plan = planId, end = new Date(Date.now() + 86400000).toISOString()) {
  const id = randomUUID();
  await getPool().query("INSERT INTO subscriptions(id,company_id,plan_id,provider,status,billing_interval,current_period_end) VALUES($1,$2,$3,'manual',$4,'month',$5)", [id, f.id, plan, status, end]);
  return id;
}
const aiInput = { messages: [{ role: "user" as const, content: "test" }], maxTokens: 10 };
function event(type: string, object: Record<string, unknown>, created = Math.floor(Date.now() / 1000)) {
  const id = `evt_${randomUUID().replaceAll("-", "")}`;
  eventIds.add(id);
  const payload = JSON.stringify({ id, type, created, data: { object } });
  const ts = Math.floor(Date.now() / 1000);
  const signature = `t=${ts},v1=${createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET!).update(`${ts}.${payload}`).digest("hex")}`;
  return { payload, signature, id };
}
async function reconcile(e: ReturnType<typeof event>, current: Record<string, unknown>) { return handleStripeEvent(e.payload, e.signature, async () => current); }
function stripe(f: Fixture, status = "active", subId = `sub_${randomUUID().replaceAll("-", "")}`, customer = `cus_${randomUUID().replaceAll("-", "")}`) {
  const now = Math.floor(Date.now() / 1000);
  return { id: subId, customer, status, metadata: { company_id: f.id, plan_id: "business" }, items: { data: [{ quantity: 1, price: { id: priceId, recurring: { interval: "month" } }, current_period_start: now, current_period_end: now + 86400 }] }, cancel_at_period_end: false };
}
before(async () => {
  process.env.TRADEPILOT_CONFIG_KEY = "test-encryption-only-" + "x".repeat(32);
  process.env.AUTH_URL = "https://app.example.test";
  process.env.TRADEPILOT_PROXY_AUTH_SECRET = "test-proxy-only-" + "x".repeat(32);
  process.env.TRADEPILOT_TRUSTED_CLIENT_IP_HEADER = "x-real-ip";
  process.env.STRIPE_WEBHOOK_SECRET = "test-webhook-only-" + "x".repeat(32);
  delete process.env.S3_BUCKET; delete process.env.S3_ACCESS_KEY_ID; delete process.env.S3_SECRET_ACCESS_KEY;
  delete process.env.AI_PLATFORM_MONTHLY_REQUEST_LIMIT; delete process.env.AI_PLATFORM_MONTHLY_TOKEN_LIMIT;
  mediaDir = await mkdtemp(join(tmpdir(), "tradepilot-p1-media-"));
  process.env.TRADEPILOT_MEDIA_DIR = mediaDir;
  await closeDbPool(); await applyMigrations(getPool());
  for (const [id, requests] of [[planId, 250], [smallPlanId, 1]] as const) await getPool().query("INSERT INTO billing_plans(id,name,monthly_request_limit,monthly_token_limit,max_members,provider_monthly_price_id) VALUES($1,$1,$2,1000000,20,$3)", [id, requests, id === planId ? priceId : null]);
});
after(async () => {
  process.env.DATABASE_URL = testUrl;
  const tracked = [...ids];
  await transaction(async client => {
    await client.query("DELETE FROM payment_events WHERE event_id=ANY($1::text[])", [[...eventIds]]);
    await client.query("DELETE FROM auth_login_buckets WHERE key_hash=ANY($1::text[])", [[...loginKeys]]);
    for (const table of ["crm_record_links", "crm_records", "crm_counters", "audit_events", "users"]) await client.query(`DELETE FROM ${table} WHERE company_id=ANY($1::uuid[])`, [tracked]);
    await client.query("DELETE FROM companies WHERE id=ANY($1::uuid[]) AND slug LIKE $2", [tracked, `${prefix}-%`]);
    await client.query("DELETE FROM billing_plans WHERE id=ANY($1::text[])", [[planId, smallPlanId]]);
  });
  await closeDbPool(); if (mediaDir) await rm(mediaDir, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

test("P1-02 real PG: independent replicas share atomic account attempt limit", async () => {
  const execute = promisify(execFile);
  const results = await Promise.all(Array.from({ length: 3 }, () => execute(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), resolve("tests/helpers/login-rate-replica.ts"), `${prefix}-replicas@example.test`, "198.51.100.91", "10"], { env: { ...process.env, TEST_DATABASE_URL: testUrl } })));
  const attempts = results.flatMap(r => JSON.parse(r.stdout) as { allowed: boolean; keys: string[] }[]);
  attempts.forEach(a => a.keys.forEach(k => loginKeys.add(k)));
  assert.equal(attempts.filter(a => a.allowed).length, 20);
});

test("P1-02 real PG: backoff, bounded denial, window recovery and spray protection", async () => {
  const email = `${prefix}-backoff@example.test`, req = loginRequest("198.51.100.92");
  for (let i = 0; i < 5; i++) { const attempt = await reserveLoginAttempt(email, req); attempt.keys.forEach(k => loginKeys.add(k)); assert.equal(attempt.allowed, true); await finishLoginAttempt(attempt, false); }
  const denied = await reserveLoginAttempt(email, req);
  assert.equal(denied.allowed, false);
  const times = (await getPool().query("SELECT blocked_until FROM auth_login_buckets WHERE key_hash=ANY($1::text[]) ORDER BY key_hash", [denied.keys])).rows;
  await reserveLoginAttempt(email, req);
  assert.deepEqual((await getPool().query("SELECT blocked_until FROM auth_login_buckets WHERE key_hash=ANY($1::text[]) ORDER BY key_hash", [denied.keys])).rows, times);
  await getPool().query("UPDATE auth_login_buckets SET window_start=now()-interval '16 minutes' WHERE key_hash=ANY($1::text[])", [denied.keys]);
  const recovered = await reserveLoginAttempt(email, req); assert.equal(recovered.allowed, true);
  await finishLoginAttempt(recovered, false); await finishLoginAttempt(await reserveLoginAttempt(email, req), true);
  const buckets = (await getPool().query("SELECT key_hash,failures FROM auth_login_buckets WHERE key_hash=ANY($1::text[])", [denied.keys])).rows;
  assert.equal(buckets.find(r => r.key_hash === denied.keys[0]).failures, 1);
  assert.equal(buckets.find(r => r.key_hash === denied.keys[1]).failures, 0);
});

test("P1-02 real PG: shared IP bucket bounds account spraying before password work", async () => {
  const req = loginRequest("198.51.100.93");
  for (let i = 0; i < 100; i++) {
    const attempt = await reserveLoginAttempt(`${prefix}-spray-${i}@example.test`, req);
    attempt.keys.forEach(k => loginKeys.add(k));
    assert.equal(attempt.allowed, true);
  }
  const denied = await reserveLoginAttempt(`${prefix}-spray-overflow@example.test`, req);
  denied.keys.forEach(k => loginKeys.add(k));
  assert.equal(denied.allowed, false);
  const independent = await reserveLoginAttempt(`${prefix}-spray-independent@example.test`, loginRequest("198.51.100.94"));
  independent.keys.forEach(k => loginKeys.add(k));
  assert.equal(independent.allowed, true);
  // Client-controlled headers without authenticated proxy context cannot create
  // fresh IP buckets to evade the safe default shared-peer limit.
  const untrusted = (ip: string) => new Request("http://localhost/api/auth/callback/credentials", { headers: { "x-real-ip": ip, "x-forwarded-for": ip } });
  const a = await reserveLoginAttempt(`${prefix}-untrusted-a@example.test`, untrusted("1.1.1.1"));
  const b = await reserveLoginAttempt(`${prefix}-untrusted-b@example.test`, untrusted("8.8.8.8"));
  for (const item of [a, b]) item.keys.forEach(k => loginKeys.add(k));
  assert.equal(a.keys[0], b.keys[0]);
});

test("P1-03 real PG: BYOK isolation, no platform fallback and concurrent daily quota", async () => {
  const a = await fixture(), b = await fixture();
  process.env.FIRECRAWL_API_KEY = "never-use-platform-key"; process.env.FIRECRAWL_TENANT_DAILY_REQUEST_LIMIT = "3";
  await assert.rejects(reserveTenantDiscovery(b.id, b.ownerId), failStatus(503));
  await assert.rejects(saveTenantDiscoverySettings(a.id, b.ownerId, { apiKey: "foreign", enabled: true, dailyRequestLimit: 5 }), failStatus(403));
  await saveTenantDiscoverySettings(a.id, a.ownerId, { apiKey: "tenant-A-key", enabled: true, dailyRequestLimit: 5 });
  await saveTenantDiscoverySettings(b.id, b.ownerId, { apiKey: "tenant-B-key", enabled: true, dailyRequestLimit: 5 });
  const reservations = await Promise.allSettled(Array.from({ length: 8 }, () => reserveTenantDiscovery(a.id, a.ownerId)));
  assert.equal(reservations.filter(r => r.status === "fulfilled").length, 3);
  reservations.filter(r => r.status === "fulfilled").forEach(r => { if (r.status === "fulfilled") assert.equal(r.value.apiKey, "tenant-A-key"); });
  assert.equal((await reserveTenantDiscovery(b.id, b.ownerId)).apiKey, "tenant-B-key");
  const settings = await getTenantDiscoverySettings(a.id); assert.equal(settings.requestsToday, 3); assert.ok(!JSON.stringify(settings).includes("tenant-A-key"));
  const stored = (await getPool().query("SELECT api_key_ciphertext FROM tenant_discovery_settings WHERE company_id=$1", [a.id])).rows[0].api_key_ciphertext;
  assert.notEqual(stored, "tenant-A-key");
});

test("P1-03 real PG: separate worker processes share reservations and UTC day rollover", async () => {
  const f = await fixture();
  process.env.FIRECRAWL_TENANT_DAILY_REQUEST_LIMIT = "3";
  await saveTenantDiscoverySettings(f.id, f.ownerId, { apiKey: "replica-cloud-key", enabled: true, dailyRequestLimit: 3 });
  const execute = promisify(execFile);
  const results = await Promise.all(Array.from({ length: 3 }, () => execute(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), resolve("tests/helpers/discovery-quota-replica.ts"), f.id, f.ownerId, "4"], { env: { ...process.env, TEST_DATABASE_URL: testUrl } })));
  const attempts = results.flatMap(r => JSON.parse(r.stdout) as { allowed: boolean; status: number }[]);
  assert.equal(attempts.filter(a => a.allowed).length, 3);
  assert.ok(attempts.filter(a => !a.allowed).every(a => a.status === 429));
  assert.equal((await getTenantDiscoverySettings(f.id)).requestsToday, 3);
  await getPool().query("UPDATE discovery_usage_events SET created_at=now()-interval '1 day' WHERE company_id=$1", [f.id]);
  assert.equal((await getTenantDiscoverySettings(f.id)).requestsToday, 0);
  assert.equal((await reserveTenantDiscovery(f.id, f.ownerId)).apiKey, "replica-cloud-key");
});

test("P1-03 real PG: failed provider searches consume quota; compatibility routes deny members before fetch", async () => {
  const f = await fixture();
  await saveTenantDiscoverySettings(f.id, f.ownerId, { apiKey: "tenant-cloud-key", enabled: true, dailyRequestLimit: 3 });
  const member = await createWorkspaceMember(f.actor, { name: "Member", email: `${prefix}-preview@example.test` });
  await changeAccountPassword(member.user.id, member.temporaryPassword, password);
  let calls = 0; const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => { calls++; assert.equal(String(url), "https://api.firecrawl.dev/v1/search"); assert.equal(new Headers(options?.headers).get("authorization"), "Bearer tenant-cloud-key"); return Response.json({ error: "mock unavailable" }, { status: 503 }); };
  try {
    await assert.rejects(searchTenantPublicPages(f.id, f.ownerId, "buyers"));
    assert.equal((await getPool().query("SELECT status FROM discovery_usage_events WHERE company_id=$1", [f.id])).rows[0].status, "failed");
    const actor = { id: member.user.id, role: "member" };
    for (const route of [compatPreview, canonicalPreview]) assert.equal((await inWorkspace(f, () => route(request("/api/products/import", { url: "https://example.test/product", isPlatformAdmin: true })), actor)).status, 403);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("P1-03 real PG: product preview aliases use workspace Cloud Key and one shared daily budget", async () => {
  const f = await fixture();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(String(url), "https://api.firecrawl.dev/v1/scrape");
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer preview-workspace-key");
    assert.equal(options?.redirect, "error");
    assert.equal(JSON.parse(String(options?.body)).url, "https://1.1.1.1/product");
    return Response.json({ success: true, data: { markdown: "A product", metadata: { title: "Workspace product" } } });
  };
  const routes = [[canonicalPreview, "/api/firecrawl/preview"], [compatPreview, "/api/products/import"]] as const;
  const invoke = (route: typeof canonicalPreview, path: string) => inWorkspace(f, () => route(request(path, { url: "https://1.1.1.1/product", apiKey: "client-must-not-override" })), platform);
  try {
    for (const [route, path] of routes) assert.equal((await invoke(route, path)).status, 503, "no instance Key fallback");
    assert.equal(calls, 0);
    await inWorkspace(f, () => saveTenantDiscoverySettings(f.id, platform.id, { apiKey: "preview-workspace-key", enabled: true, dailyRequestLimit: 2 }), platform);
    for (const [route, path] of routes) {
      const response = await invoke(route, path);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).preview.name, "Workspace product");
    }
    assert.equal(calls, 2);
    for (const [route, path] of routes) assert.equal((await invoke(route, path)).status, 429);
    assert.equal(calls, 2, "quota denial must happen before provider fetch");
    assert.equal((await getTenantDiscoverySettings(f.id)).requestsToday, 2);
    assert.deepEqual((await getPool().query("SELECT status FROM discovery_usage_events WHERE company_id=$1", [f.id])).rows.map(r => r.status), ["success", "success"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("P1-03 real PG: preview bounds and private URLs reject before quota; provider failure remains charged", async () => {
  const f = await fixture();
  await saveTenantDiscoverySettings(f.id, f.ownerId, { apiKey: "preview-failure-key", enabled: true, dailyRequestLimit: 1 });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: "private-upstream-detail-preview-failure-key" }, { status: 503 }); };
  const routes = [[canonicalPreview, "/api/firecrawl/preview"], [compatPreview, "/api/products/import"]] as const;
  try {
    for (const [route, path] of routes) {
      assert.equal((await inWorkspace(f, () => route(request(path, { url: "http://127.0.0.1/private" })), platform)).status, 400);
      assert.equal((await inWorkspace(f, () => route(request(path, { url: "https://1.1.1.1/product", padding: "x".repeat(8001) })), platform)).status, 413);
    }
    assert.equal(calls, 0);
    assert.equal((await getTenantDiscoverySettings(f.id)).requestsToday, 0);
    const failure = await inWorkspace(f, () => canonicalPreview(request("/api/firecrawl/preview", { url: "https://1.1.1.1/product" })), platform);
    assert.equal(failure.status, 502);
    assert.ok(!(await failure.text()).includes("preview-failure-key"));
    assert.equal((await getPool().query("SELECT status FROM discovery_usage_events WHERE company_id=$1", [f.id])).rows[0].status, "failed");
    assert.equal((await inWorkspace(f, () => compatPreview(request("/api/products/import", { url: "https://1.1.1.1/product" })), platform)).status, 429);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("P1-04 real PG: marketing=false, member resubscribe and self-reported consent cannot bypass suppression", async () => {
  const f = await fixture(); await account(f); const recipient = `${prefix}-suppressed@example.test`;
  await setSuppression(f.id, recipient, {});
  await assert.rejects(recordMarketingConsent(f.id, recipient, { subscribed: true }), failStatus(409));
  await assert.rejects(setSuppression(f.id, recipient, { resubscribe: true }), failStatus(409));
  process.env.REQUIRE_MARKETING_CONSENT = "false";
  const sent = await inWorkspace(f, () => emailSend(request("/api/email", { action: "send", accountId: "mail", to: recipient, subject: "Blocked", body: "Test", marketing: false })));
  assert.equal(sent.status, 409); assert.equal((await sent.json()).code, "EMAIL_SUPPRESSED");
  assert.equal((await getPool().query("SELECT count(*)::int n FROM email_send_events WHERE company_id=$1", [f.id])).rows[0].n, 0);
  const old = `${prefix}-legacy@example.test`;
  await getPool().query("INSERT INTO email_marketing_consents(company_id,email,status,source) VALUES($1,$2,'subscribed','old-import')", [f.id, old]);
  await assert.rejects(assertMarketingRecipientsAllowed(f.id, [old]), failStatus(409));
});

test("P1-04 real PG: recipient-only double opt-in, GET is read-only, token scoped and single-use", async () => {
  const a = await fixture(), b = await fixture(); await account(a);
  const email = `${prefix}-confirmed@example.test`; await setSuppression(a.id, email, {});
  const { token, link } = await challenge(a, email);
  const before = (await getPool().query("SELECT * FROM email_consent_challenges WHERE company_id=$1", [a.id])).rows;
  assert.equal((await subscribeGET(new Request(link))).status, 200);
  const unsubscribeToken = createUnsubscribeToken(a.id, email);
  assert.equal((await unsubscribeGET(new Request(`http://localhost/api/email/unsubscribe?token=${unsubscribeToken}`))).status, 200);
  assert.deepEqual((await getPool().query("SELECT * FROM email_consent_challenges WHERE company_id=$1", [a.id])).rows, before);
  const concurrent = await Promise.allSettled([confirmMarketingConsent(token), confirmMarketingConsent(token)]);
  assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1);
  await assertMarketingRecipientsAllowed(a.id, [email]);
  await assert.rejects(assertMarketingRecipientsAllowed(b.id, [email]), failStatus(409));
  await setSuppression(a.id, email, {}); await assert.rejects(confirmMarketingConsent(token), failStatus(410)); assert.equal(await isSuppressed(a.id, email), true);
  const serialized = JSON.stringify((await getPool().query("SELECT * FROM email_consent_challenges WHERE company_id=$1", [a.id])).rows); assert.ok(!serialized.includes(token));
});

test("P1-04 real PG: expired/invalidated challenges and delivery failures never clear suppression", async () => {
  const f = await fixture(); await account(f);
  const email = `${prefix}-expired@example.test`; await setSuppression(f.id, email, {});
  const { token } = await challenge(f, email);
  await getPool().query("UPDATE email_consent_challenges SET expires_at=now()-interval '1 minute' WHERE company_id=$1", [f.id]);
  await assert.rejects(confirmMarketingConsent(token), failStatus(410));
  const fresh = await challenge(f, email); await setSuppression(f.id, email, {});
  await assert.rejects(confirmMarketingConsent(fresh.token), failStatus(410));
  const failedEmail = `${prefix}-delivery@example.test`;
  await assert.rejects(requestMarketingOptIn(f.id, failedEmail, async () => { throw new Error("mock SMTP fail"); }));
  assert.equal((await getPool().query("SELECT invalidated_at IS NOT NULL invalid FROM email_consent_challenges WHERE company_id=$1 AND email=$2", [f.id, failedEmail])).rows[0].invalid, true);
});

test("P1-04 real PG: concurrent confirm/unsubscribe serializes to final suppression", async () => {
  const f = await fixture(); await account(f); const email = `${prefix}-race@example.test`;
  const { token } = await challenge(f, email);
  await Promise.allSettled([confirmMarketingConsent(token), setSuppression(f.id, email, {})]);
  assert.equal(await isSuppressed(f.id, email), true);
  await assert.rejects(assertMarketingRecipientsAllowed(f.id, [email]), failStatus(409));
});

test("P1-05 real PG: media bytes/MIME, tenant isolation, Range/HEAD and legacy active content", async () => {
  const a = await fixture(), b = await fixture();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=", "base64");
  const asset = await createMediaAsset({ companyId: a.id, actorId: a.ownerId, kind: "attachment", filename: "image.png", mimeType: "image/png", body: png });
  assert.equal((await getMediaAsset(a.id, asset.id))?.verifiedMimeType, "image/png"); assert.equal(await getMediaAsset(b.id, asset.id), null);
  const response = await inWorkspace(a, () => mediaGET(new NextRequest(`http://localhost/api/media/${asset.id}`), params(asset.id)));
  assert.equal(response.headers.get("content-type"), "image/png"); assert.match(response.headers.get("content-disposition")!, /^inline/); assert.equal(response.headers.get("x-content-type-options"), "nosniff"); assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  const range = await inWorkspace(a, () => mediaGET(new NextRequest(`http://localhost/api/media/${asset.id}`, { headers: { Range: "bytes=0-7" } }), params(asset.id))); assert.equal(range.status, 206); assert.deepEqual(Buffer.from(await range.arrayBuffer()), png.subarray(0, 8));
  const head = await inWorkspace(a, () => mediaHEAD(new NextRequest(`http://localhost/api/media/${asset.id}`, { method: "HEAD" }), params(asset.id))); assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
  for (const [filename, mime] of [["active.html", "text/html"], ["active.svg", "image/svg+xml"]]) {
    const body = Buffer.from("<svg onload=alert(document.cookie)>active</svg>");
    await assert.rejects(createMediaAsset({ companyId: a.id, actorId: a.ownerId, kind: "attachment", filename, mimeType: mime, body }), failStatus(415));
    const id = randomUUID(), key = `${a.id}/legacy/${filename}`; await putObject({ key, body, contentType: mime });
    await getPool().query("INSERT INTO media_assets(id,company_id,object_key,kind,filename,mime_type,size_bytes,sha256,storage_provider,status,created_by) VALUES($1,$2,$3,'attachment',$4,$5,$6,$7,'local','ready',$8)", [id, a.id, key, filename, mime, body.length, createHash("sha256").update(body).digest("hex"), a.ownerId]);
    const legacy = await inWorkspace(a, () => mediaGET(new NextRequest(`http://localhost/api/media/${id}`), params(id)));
    assert.equal(legacy.headers.get("content-type"), "application/octet-stream"); assert.match(legacy.headers.get("content-disposition")!, /^attachment/); assert.match(legacy.headers.get("content-security-policy")!, /sandbox/); await legacy.arrayBuffer();
  }
});

test("P1-05: S3 presigning overrides legacy object's active MIME/disposition without network", async () => {
  process.env.S3_BUCKET = "audit-test"; process.env.S3_ACCESS_KEY_ID = "test-access"; process.env.S3_SECRET_ACCESS_KEY = "test-secret"; process.env.S3_REGION = "us-east-1";
  try {
    const policy = mediaDeliveryPolicy({ filename: "active.svg", verifiedMimeType: null });
    const url = new URL(await signedObjectUrl("audit/active.svg", 60, policy));
    assert.equal(url.searchParams.get("response-content-type"), "application/octet-stream"); assert.match(url.searchParams.get("response-content-disposition")!, /^attachment/);
  } finally { delete process.env.S3_BUCKET; delete process.env.S3_ACCESS_KEY_ID; delete process.env.S3_SECRET_ACCESS_KEY; }
});

test("P1-06 real PG: saving private mail endpoints fails before storing account or credentials", async () => {
  const f = await fixture();
  for (const smtpHost of ["127.0.0.1", "169.254.169.254", "10.0.0.2", "::ffff:7f00:1"]) {
    const response = await inWorkspace(f, () => emailAccountSave(request("/api/email/accounts", { name: "No SSRF", email: "sender@example.test", smtpHost, smtpPort: 465, smtpSecure: true, smtpPassword: "not-stored", imapHost: "127.0.0.1", imapPort: 993, imapSecure: true })));
    assert.equal(response.status, 400);
  }
  assert.equal((await getPool().query("SELECT count(*)::int n FROM crm_records WHERE company_id=$1 AND kind='email_accounts'", [f.id])).rows[0].n, 0);
  assert.equal((await getPool().query("SELECT count(*)::int n FROM email_account_secrets WHERE company_id=$1", [f.id])).rows[0].n, 0);
});

test("P1-07 real PG: every status/expiry reads the same effective entitlement as billing UI", async () => {
  const f = await fixture(); await ai(f); const id = await subscription(f);
  for (const status of ["active", "trialing", "past_due", "unpaid", "paused", "incomplete", "incomplete_expired", "canceled"]) {
    await getPool().query("UPDATE subscriptions SET status=$2,trial_end=now()+interval '1 day' WHERE id=$1", [id, status]);
    const expected = ["active", "trialing"].includes(status) ? 250 : 100;
    assert.equal((await getEffectiveEntitlements(f.id)).requestLimit, expected);
    assert.equal((await getBillingSummary(f.id)).usage.requestLimit, expected);
  }
  await getPool().query("UPDATE subscriptions SET status='active',cancel_at_period_end=true WHERE id=$1", [id]); assert.equal((await getEffectiveEntitlements(f.id)).requestLimit, 250);
  await getPool().query("UPDATE subscriptions SET current_period_end=now()-interval '1 second' WHERE id=$1", [id]); assert.equal((await getEffectiveEntitlements(f.id)).plan.id, "free");
  await getPool().query("UPDATE subscriptions SET status='trialing',current_period_end=now()+interval '1 day',trial_end=now()-interval '1 second' WHERE id=$1", [id]); assert.equal((await getEffectiveEntitlements(f.id)).plan.id, "free");
});

test("P1-07 real PG: actual AI reservation enforces free downgrade, plan cap, disabled billing and platform caps", async () => {
  const f = await fixture(); await ai(f); const id = await subscription(f, "past_due");
  await getPool().query("INSERT INTO ai_usage_events(id,company_id,user_id,task,provider,model,status,tokens_used) SELECT gen_random_uuid(),$1,$2,'email_compose','openai','mock','success',1 FROM generate_series(1,100)", [f.id, f.ownerId]);
  await assert.rejects(reserveTenantAIRequest(f.id, f.ownerId, "email_compose", aiInput), failStatus(429));
  await getPool().query("UPDATE subscriptions SET status='active' WHERE id=$1", [id]);
  const allowed = await reserveTenantAIRequest(f.id, f.ownerId, "email_compose", aiInput); await finishTenantAIRequest(allowed.id, { ok: false, fallbackTokens: allowed.reservedTokens });
  await getPool().query("UPDATE subscriptions SET plan_id=$2 WHERE id=$1", [id, smallPlanId]); await assert.rejects(reserveTenantAIRequest(f.id, f.ownerId, "email_compose", aiInput), failStatus(429));
  await getPool().query("UPDATE subscriptions SET plan_id=$2 WHERE id=$1", [id, planId]);
  for (const status of ["closed", "paused"]) { await getPool().query("INSERT INTO billing_accounts(company_id,status) VALUES($1,$2) ON CONFLICT(company_id) DO UPDATE SET status=EXCLUDED.status", [f.id, status]); await assert.rejects(reserveTenantAIRequest(f.id, f.ownerId, "email_compose", aiInput), failStatus(429)); }
  await getPool().query("UPDATE billing_accounts SET status='active' WHERE company_id=$1", [f.id]);
  process.env.AI_PLATFORM_MONTHLY_REQUEST_LIMIT = "0"; await assert.rejects(reserveTenantAIRequest(f.id, f.ownerId, "email_compose", aiInput), failStatus(429));
  process.env.AI_PLATFORM_MONTHLY_REQUEST_LIMIT = "invalid"; assert.equal((await getEffectiveEntitlements(f.id)).requestLimit, 0); delete process.env.AI_PLATFORM_MONTHLY_REQUEST_LIMIT;
});

test("P1-07 real PG: concurrent budget reservations, failures and expired pending never release cost", async () => {
  const f = await fixture(); await ai(f, 3);
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => reserveTenantAIRequest(f.id, f.ownerId, "email_compose", aiInput)));
  const allowed = results.flatMap(r => r.status === "fulfilled" ? [r.value] : []); assert.equal(allowed.length, 3);
  await finishTenantAIRequest(allowed[0].id, { ok: false, fallbackTokens: allowed[0].reservedTokens });
  await getPool().query("UPDATE ai_usage_events SET created_at=now()-interval '16 minutes' WHERE id=$1", [allowed[1].id]);
  await ai(f, 4); const fourth = await reserveTenantAIRequest(f.id, f.ownerId, "email_compose", aiInput); assert.equal(fourth.maxTokens, 10);
  const expired = (await getPool().query("SELECT status,tokens_used FROM ai_usage_events WHERE id=$1", [allowed[1].id])).rows[0]; assert.equal(expired.status, "failed"); assert.equal(expired.tokens_used, allowed[1].reservedTokens);
  await assert.rejects(reserveTenantAIRequest(f.id, f.ownerId, "email_compose", aiInput), failStatus(429));
  const b = await fixture(); await ai(b, 2, 1000); await assert.rejects(reserveTenantAIRequest(b.id, b.ownerId, "email_compose", { ...aiInput, maxTokens: 10000 }), failStatus(429));
});

test("P1-04 real PG: authenticated link is tenant scoped and cannot act as an opt-in confirmation", async () => {
  const f = await fixture();
  const before = Number((await getPool().query("SELECT count(*)::int AS n FROM email_consent_challenges WHERE company_id=$1", [f.id])).rows[0].n);
  const response = await inWorkspace(f, () => consentLinkGET()); assert.equal(response.status, 200);
  const data = await response.json(), link = new URL(data.subscribeUrl);
  assert.equal(link.pathname, "/api/email/subscribe"); assert.equal(link.searchParams.get("workspace"), f.id);
  assert.equal(link.searchParams.has("token"), false); assert.deepEqual(Object.keys(data), ["subscribeUrl"]);
  const page = await subscribeGET(new Request(link)); assert.equal(page.status, 200);
  assert.equal(Number((await getPool().query("SELECT count(*)::int AS n FROM email_consent_challenges WHERE company_id=$1", [f.id])).rows[0].n), before);
});

test("P1-07 real PG: member AI readiness uses only its workspace BYOK and effective allowance", async () => {
  const a = await fixture(), b = await fixture(); await ai(a, 1);
  const member = { id:a.ownerId, role:"member" };
  const ready = await inWorkspace(a, () => aiStatusGET(), member);
  assert.equal(ready.status, 200);
  const body = await ready.json(); assert.equal(body.scope, "tenant"); assert.equal(body.textReady, true);
  assert.equal(body.configurationUrl, "/app/ai-usage");
  assert.ok(!JSON.stringify(body).includes(`${prefix}-ai-key`));
  for (const forbidden of ["tasks", "provider", "model", "apiKey", "api_key_ciphertext", "recent"]) assert.equal(body[forbidden], undefined);
  assert.equal((await (await inWorkspace(b, () => aiStatusGET())).json()).textReady, false, "B cannot use A or the platform key");
  const reservation = await reserveTenantAIRequest(a.id, a.ownerId, "lead_generation", aiInput);
  await finishTenantAIRequest(reservation.id, { ok:false, fallbackTokens:reservation.reservedTokens });
  const exhausted = await (await inWorkspace(a, () => aiStatusGET(), member)).json();
  assert.equal(exhausted.textReady, false); assert.match(exhausted.unavailableReason, /额度/);
  await ai(a, 10); assert.equal((await (await inWorkspace(a, () => aiStatusGET(), member)).json()).textReady, true);
  await getPool().query("UPDATE tenant_ai_settings SET enabled=false WHERE company_id=$1", [a.id]);
  assert.equal((await (await inWorkspace(a, () => aiStatusGET(), member)).json()).textReady, false);
});

test("P1-08 real PG: old/same-second/invoice events reconcile authoritative state, not metadata", async () => {
  const f = await fixture(); const canonical = stripe(f); const timestamp = Math.floor(Date.now() / 1000);
  const first = event("customer.subscription.updated", { ...canonical, status: "past_due" }, timestamp);
  await reconcile(first, canonical);
  const stored = (await getPool().query("SELECT * FROM subscriptions WHERE company_id=$1", [f.id])).rows[0]; assert.equal(stored.plan_id, planId); assert.equal(stored.status, "active"); assert.ok(stored.current_period_end); assert.ok(stored.reconciled_at);
  const unpaid = { ...canonical, status: "unpaid" };
  await Promise.all([reconcile(event("invoice.paid", { subscription: canonical.id }, timestamp - 100), unpaid), reconcile(event("customer.subscription.updated", { ...canonical, status: "active" }, timestamp), unpaid)]);
  assert.equal((await getPool().query("SELECT status FROM subscriptions WHERE company_id=$1", [f.id])).rows[0].status, "unpaid");
  await reconcile(event("invoice.payment_failed", { parent: { subscription_details: { subscription: canonical.id } } }, timestamp - 100), canonical);
  assert.equal((await getPool().query("SELECT status FROM subscriptions WHERE company_id=$1", [f.id])).rows[0].status, "active");
  let calls = 0; const duplicate = await handleStripeEvent(first.payload, first.signature, async () => { calls++; throw new Error("should not retrieve duplicate"); }); assert.equal(duplicate.duplicate, true); assert.equal(calls, 0);
});

test("P1-08 real PG: terminal cancellation cannot be resurrected; foreign tenant binding is rejected", async () => {
  const a = await fixture(), b = await fixture(); const canonical = stripe(a);
  await reconcile(event("customer.subscription.created", canonical), canonical);
  await reconcile(event("customer.subscription.deleted", canonical), { ...canonical, status: "canceled" });
  await assert.rejects(reconcile(event("invoice.paid", { subscription: canonical.id }), canonical), failStatus(409));
  await assert.rejects(reconcile(event("customer.subscription.updated", { ...canonical, metadata: { company_id: b.id } }), { ...canonical, status: "canceled" }), failStatus(409));
  const records = (await getPool().query("SELECT company_id,status FROM subscriptions WHERE provider_subscription_id=$1", [canonical.id])).rows;
  assert.deepEqual(records, [{ company_id: a.id, status: "canceled" }]);
  const foreign = stripe(b, "active", undefined, canonical.customer); await assert.rejects(reconcile(event("customer.subscription.created", foreign), foreign), failStatus(409));
});

test("P1-08 real PG: failed reconciliation rolls back receipt and is retryable; unmapped prices fail closed", async () => {
  const f = await fixture(); const canonical = stripe(f); const e = event("customer.subscription.updated", canonical);
  await assert.rejects(handleStripeEvent(e.payload, e.signature, async () => { throw new Error("mock Stripe timeout"); }), failStatus(503));
  assert.equal((await getPool().query("SELECT count(*)::int n FROM payment_events WHERE event_id=$1", [e.id])).rows[0].n, 0);
  const bad = { ...canonical, items: { data: [{ quantity: 1, price: { id: "price_unmapped", recurring: { interval: "month" } } }] } };
  await assert.rejects(reconcile(e, bad), failStatus(503));
  assert.equal((await getPool().query("SELECT count(*)::int n FROM subscriptions WHERE company_id=$1", [f.id])).rows[0].n, 0);
  assert.equal((await reconcile(e, canonical)).duplicate, false);
});

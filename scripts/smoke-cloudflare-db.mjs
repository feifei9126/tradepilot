import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { postgresPoolConfig } from "./database/config.mjs";
import { applyMigrations } from "./database/migrations.mjs";

// Never use DATABASE_URL or a remote database for automated integration tests.
const value = process.env.TEST_DATABASE_URL;
if (!value) throw new Error("TEST_DATABASE_URL is required");
const parsed = new URL(value);
if (!["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
    !/^\/[a-zA-Z0-9_-]+_test$/.test(parsed.pathname)) {
  throw new Error("Refusing Worker integration tests outside a loopback *_test database");
}
process.env.DATABASE_URL = value;
process.env.PGSSLMODE = "disable";
const pool = new Pool({ ...postgresPoolConfig(), max: 1 });
await applyMigrations(pool);
const root = fileURLToPath(new URL("../", import.meta.url));
const probe = createServer();
await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const { port } = probe.address();
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const directory = await mkdtemp(join(tmpdir(), "tradepilot-worker-db-"));
const slug = `worker-login-check-${randomUUID().slice(0, 12)}`;
const email = `${slug}@example.test`;
const password = `Start-${randomUUID()}`;
const nextPassword = `Finish-${randomUUID()}`;
const envFile = join(directory, "database.env");
await writeFile(envFile, [
  `AUTH_SECRET=${randomBytes(32).toString("hex")}`, `AUTH_URL=${origin}`,
  `DATABASE_URL=${value}`, "TRADEPILOT_ADMIN_STORE=postgres",
  `TRADEPILOT_ADMIN_EMAIL=${email}`, `TRADEPILOT_ADMIN_PASSWORD=${password}`,
  `TRADEPILOT_WORKSPACE_SLUG=${slug}`,
  "PGHOST=", "PGDATABASE=", "PGUSER=", "PGPASSWORD=", "PGSSLMODE=disable",
].join("\n") + "\n", { mode: 0o600 });
const child = spawn(process.execPath, [
  join(root, "node_modules/wrangler/bin/wrangler.js"),
  "dev", "--local", "--ip", "127.0.0.1", "--port", String(port),
  "--inspector-port", "0", "--env-file", envFile,
  "--persist-to", join(directory, "state"), "--log-level", "error",
], { cwd: root, env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
for (const output of [child.stdout, child.stderr]) output.on("data", data => { logs = (logs + data.toString()).slice(-32000); });
const exited = new Promise(resolve => child.once("close", resolve));
let spawnError;
child.on("error", error => { spawnError = error; });
let cookie = "";
function capture(response) {
  const jar = new Map(cookie.split("; ").filter(Boolean).map(item => [item.slice(0, item.indexOf("=")), item]));
  for (const item of response.headers.getSetCookie()) {
    const entry = item.split(";")[0];
    jar.set(entry.slice(0, entry.indexOf("=")), entry);
  }
  cookie = [...jar.values()].join("; ");
}
async function request(path, options = {}) {
  const response = await fetch(origin + path, {
    ...options, redirect: "manual", headers: { Cookie: cookie, Origin: origin, ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(30000),
  });
  capture(response);
  return response;
}
async function login(credential) {
  cookie = "";
  const csrf = await request("/api/auth/csrf");
  assert.equal(csrf.status, 200);
  assert.equal(csrf.headers.getSetCookie().filter(item => item.startsWith("authjs.csrf-token=")).length, 1);
  const { csrfToken } = await csrf.json();
  const response = await request("/api/auth/callback/credentials", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({ csrfToken, email, password: credential, callbackUrl: origin + "/app" }),
  });
  assert.equal(response.status, 200);
  return new URL((await response.json()).url, origin);
}
try {
  const deadline = Date.now() + 90000;
  let started = false;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error("Wrangler exited before startup");
    try {
      if ((await request("/icon.svg", { signal: AbortSignal.timeout(3000) })).status === 200) { started = true; break; }
    } catch { /* Wait for the local listener. */ }
    await delay(300);
  }
  assert.ok(started, "Worker start");
  const health = await request("/api/health/ready");
  assert.equal(health.status, 200);
  assert.equal((await login(password)).searchParams.get("error"), null);
  console.log("PASS Worker + PostgreSQL: readiness and authenticated admin bootstrap");
  const session = await request("/api/auth/session");
  const claims = (await session.json()).user;
  assert.equal(claims?.isPlatformAdmin, true);
  assert.equal(claims?.mustChangePassword, true);
  const blocked = await request("/app");
  assert.equal(blocked.status, 307);
  assert.ok(blocked.headers.get("location").includes("/app/account"));
  console.log("PASS Worker + PostgreSQL: proxy rechecks the admin and enforces first password change");
  const change = await request("/api/account/password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: password, newPassword: nextPassword, confirmPassword: nextPassword }),
  });
  assert.equal(change.status, 200, await change.clone().text());
  const old = await request("/api/auth/session");
  assert.equal((await old.json()).user?.id, "");
  assert.ok((await login(password)).searchParams.get("error"));
  assert.equal((await login(nextPassword)).searchParams.get("error"), null);
  console.log("PASS Worker + PostgreSQL: persisted password, old session revoked, new login succeeds");
  const profile = await request("/api/account");
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).email, email);
  const app = await request("/app");
  assert.equal(app.status, 200);
  const results = await Promise.all(["/api/contacts", "/api/account", "/api/auth/session"].map(async path => {
    const response = await request(path);
    return [path, response.status];
  }));
  for (const [path, status] of results) assert.equal(status, 200, path);
  console.log("PASS Worker + PostgreSQL: /app 200 and concurrent authenticated requests");
} catch (error) {
  console.error(logs.replaceAll(password, "[redacted]").replaceAll(nextPassword, "[redacted]"));
  throw error;
} finally {
  child.kill("SIGTERM");
  const killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
  await exited;
  clearTimeout(killTimer);
  await rm(directory, { recursive: true, force: true });
  try {
    const company = (await pool.query("SELECT id FROM companies WHERE slug=$1", [slug])).rows[0];
    if (company) {
      await pool.query("DELETE FROM audit_events WHERE company_id=$1", [company.id]);
      await pool.query("DELETE FROM users WHERE company_id=$1", [company.id]);
      await pool.query("DELETE FROM companies WHERE id=$1", [company.id]);
    }
  } finally { await pool.end(); }
}

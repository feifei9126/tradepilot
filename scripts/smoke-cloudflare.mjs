import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { encode } from "next-auth/jwt";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Run the generated Worker, including the auth proxy, rather than only bundling it.
// No cloud account, database, real credentials or remote deployment are needed.
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "tradepilot-worker-smoke-"));
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", resolve);
});
const { port } = probe.address();
await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
const origin = `http://127.0.0.1:${port}`;
const envFile = join(directory, "smoke.env");
const secret = randomBytes(32).toString("hex");
await writeFile(envFile, [
  `AUTH_SECRET=${secret}`,
  `AUTH_URL=${origin}`,
  "DATABASE_URL=", "PGHOST=", "PGDATABASE=", "PGUSER=", "PGPASSWORD=",
  "TRADEPILOT_ADMIN_EMAIL=", "TRADEPILOT_ADMIN_PASSWORD=",
].join("\n") + "\n", { mode: 0o600 });

const child = spawn(process.execPath, [
  join(root, "node_modules/wrangler/bin/wrangler.js"),
  "dev", "--local", "--ip", "127.0.0.1", "--port", String(port),
  "--inspector-port", "0", "--env-file", envFile,
  "--persist-to", join(directory, "state"), "--log-level", "error",
], { cwd: root, env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
for (const output of [child.stdout, child.stderr]) output.on("data", (chunk) => {
  logs = (logs + chunk.toString()).slice(-24_000);
});
let spawnError;
child.on("error", (error) => { spawnError = error; });
const exited = new Promise((resolve) => child.once("close", resolve));
async function request(path, options = {}) {
  return fetch(origin + path, { ...options, redirect: "manual", signal: AbortSignal.timeout(15_000) });
}
try {
  const deadline = Date.now() + 90_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Wrangler exited with code ${child.exitCode}`);
    try {
      const response = await request("/icon.svg");
      await response.text();
      if (response.status === 200) { ready = true; break; }
    } catch { /* Wait for the local listener, not a successful dynamic response. */ }
    await delay(250);
  }
  assert.ok(ready, "Local Worker did not start within 90 seconds");
  for (const path of ["/", "/auth/login", "/auth/register"]) {
    const response = await request(path);
    const body = await response.text();
    assert.equal(response.status, 200, `${path}: ${response.status} ${body.slice(0, 600)}`);
    assert.match(response.headers.get("content-type") || "", /text\/html/);
    assert.match(body, /TradePilot/);
    console.log(`PASS ${path}: 200 HTML`);
  }
  const live = await request("/api/health/live");
  assert.equal(live.status, 200, await live.clone().text());
  assert.equal((await live.json()).status, "ok");
  console.log("PASS /api/health/live: 200 JSON");
  const session = await request("/api/auth/session");
  assert.equal(session.status, 200, await session.clone().text());
  assert.equal((await session.json())?.user, undefined);
  console.log("PASS /api/auth/session: unauthenticated JSON");
  const contacts = await request("/api/contacts");
  assert.equal(contacts.status, 401, await contacts.clone().text());
  assert.ok((await contacts.json()).error);
  console.log("PASS /api/contacts: 401 (auth proxy enforced)");
  const app = await request("/app");
  assert.equal(app.status, 307, await app.clone().text());
  assert.equal(new URL(app.headers.get("location"), origin).pathname, "/auth/login");
  console.log("PASS /app: login redirect (auth proxy enforced)");
  // A valid encrypted session must still recheck the authoritative account.
  // With no database it must fail closed, rather than granting access or crashing.
  const salt = "authjs.session-token";
  const token = await encode({ secret, salt, token: { sub: randomUUID(), sessionVersion: "0" }, maxAge: 60 });
  const headers = { Cookie: `${salt}=${token}` };
  for (const path of ["/api/contacts", "/app"]) {
    const response = await request(path, { headers });
    assert.equal(response.status, 503, `${path}: ${await response.text()}`);
    console.log(`PASS ${path}: existing session fails closed without database`);
  }
  const checkedSession = await request("/api/auth/session", { headers });
  assert.equal(checkedSession.status, 200, await checkedSession.clone().text());
  const claims = (await checkedSession.json()).user;
  assert.equal(claims?.databaseUnavailable, true);
  assert.equal(claims?.id, "");
  console.log("PASS /api/auth/session: database outage removes usable claims");
  const revoked = await encode({ secret, salt, token: { sub: "deployment-admin", sessionVersion: "0" }, maxAge: 60 });
  const revokedResponse = await request("/api/contacts", { headers: { Cookie: `${salt}=${revoked}` } });
  assert.equal(revokedResponse.status, 401, await revokedResponse.clone().text());
  console.log("PASS /api/contacts: inactive deployment account cannot retain access");
  const csrf = await request("/api/auth/csrf");
  assert.equal(csrf.status, 200, await csrf.clone().text());
  const { csrfToken } = await csrf.json();
  assert.ok(csrfToken);
  const cookies = csrf.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  const login = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { Cookie: cookies, Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email: "smoke@example.invalid", password: "smoke-only-password", callbackUrl: `${origin}/app` }),
  });
  assert.ok([302, 303].includes(login.status), `Login: ${login.status} ${await login.text()}`);
  assert.equal(new URL(login.headers.get("location"), origin).searchParams.get("error"), "CredentialsSignin");
  console.log("PASS credentials callback: fails closed without database");
  const readyResponse = await request("/api/health/ready");
  assert.equal(readyResponse.status, 503, await readyResponse.clone().text());
  await readyResponse.json();
  console.log("PASS /api/health/ready: 503 without database");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill("SIGTERM");
  const killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
  await exited;
  clearTimeout(killTimer);
  await rm(directory, { recursive: true, force: true });
}

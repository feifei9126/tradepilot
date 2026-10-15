import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { closeDbPool, getPool } from "../../src/db";
import { applyMigrations } from "../../scripts/database/migrations.mjs";
import { GET as registrationStatus, POST as register } from "../../src/app/api/auth/register/route";
import { findUserByCredentials } from "../../src/lib/registration";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required; use a separate loopback *_test database");
const parsedUrl = new URL(testUrl);
if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname) || !/^\/[a-zA-Z0-9_-]+_test$/.test(parsedUrl.pathname)) {
  throw new Error("Refusing registration integration tests outside a loopback *_test database");
}
process.env.DATABASE_URL = testUrl;
process.env.PGSSLMODE = "disable";
process.env.AUTH_URL = "http://localhost:3461";
const prefix = `registration-${randomUUID().slice(0, 8)}`;
const workspaceIds = new Set<string>();

function request(body: unknown, origin = process.env.AUTH_URL!) {
  return new Request(`${process.env.AUTH_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

before(async () => {
  await closeDbPool();
  await applyMigrations(getPool());
});

after(async () => {
  try {
    const ids = [...workspaceIds];
    if (ids.length) {
      await getPool().query("DELETE FROM users WHERE company_id=ANY($1::uuid[])", [ids]);
      await getPool().query("DELETE FROM companies WHERE id=ANY($1::uuid[])", [ids]);
    }
    await getPool().query("DELETE FROM rate_limit_counters WHERE scope IN ('public-registration-ip','public-registration-email')");
  } finally {
    await closeDbPool();
  }
});

test("disabled self-registration is reported and rejects attempts", async () => {
  process.env.TRADEPILOT_SELF_REGISTRATION = "false";
  const status = await registrationStatus();
  assert.equal((await status.json()).enabled, false);

  const response = await register(request({}));
  assert.equal(response.status, 403);
});

test("self-registration rejects cross-origin submissions before creating a workspace", async () => {
  process.env.TRADEPILOT_SELF_REGISTRATION = "true";
  const response = await register(request({ company: `${prefix} Cross Site`, name: "Blocked", email: `${prefix}-blocked@example.test`, password: "TrialUser-Pass2026" }, "https://attacker.invalid"));
  assert.equal(response.status, 403);
});

test("enabled self-registration creates an isolated workspace owner and accepts that login", async () => {
  process.env.TRADEPILOT_SELF_REGISTRATION = "true";
  const email = `${prefix}@example.test`;
  const response = await register(request({
    company: `Trial ${prefix}`,
    name: "Trial Owner",
    email,
    password: "TrialUser-Pass2026",
  }));

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });

  const user = await findUserByCredentials(email, "TrialUser-Pass2026");
  assert.ok(user);
  assert.equal(user.role, "owner");
  assert.equal(user.isDeploymentWorkspace, false);
  assert.equal(user.isPlatformAdmin, false);
  workspaceIds.add(user.companyId);
  const workspace = await getPool().query("SELECT slug FROM companies WHERE id=$1", [user.companyId]);
  assert.match(workspace.rows[0].slug, new RegExp(`^trial-${prefix}-`));
});

test("registration rate limits repeated requests for an email", async () => {
  process.env.TRADEPILOT_SELF_REGISTRATION = "true";
  const email = `${prefix}-limited@example.test`;
  const payload = { company: `Trial ${prefix}`, name: "Trial Owner", email, password: "TrialUser-Pass2026" };
  const responses: Response[] = [];
  for (let i = 0; i < 6; i += 1) responses.push(await register(request(payload)));
  assert.equal(responses[0].status, 201);
  assert.equal(responses.slice(1, 5).every(response => response.status === 409), true);
  assert.equal(responses[5].status, 429);

  const result = await getPool().query("SELECT id FROM companies WHERE slug LIKE $1", [`trial-${prefix}%`]);
  for (const row of result.rows) workspaceIds.add(String(row.id));
});

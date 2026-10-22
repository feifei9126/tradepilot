import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { configureTestDatabase } from "../helpers/test-database";
import { closeDbPool, getPool } from "../../src/db";
import { applyMigrations } from "../../scripts/database/migrations.mjs";
import { bootstrapOwner } from "../../scripts/database/bootstrap.mjs";
import { changeAccountPassword, getAccountProfile, getAuthSessionState, updateAccountProfile, verifyDeploymentAdmin } from "../../src/lib/account";

configureTestDatabase();
const oldEnv = { ...process.env };
const slug = `admin-test-${randomUUID()}`;
const email = `${slug}@example.test`;
const initialPassword = `Initial-${randomUUID()}`;
const newPassword = `Changed-${randomUUID()}`;
let companyId: string;
let userId: string;
before(async () => {
  process.env.TRADEPILOT_ADMIN_STORE = "postgres";
  process.env.TRADEPILOT_ADMIN_EMAIL = email;
  process.env.TRADEPILOT_ADMIN_PASSWORD = initialPassword;
  process.env.TRADEPILOT_WORKSPACE_SLUG = slug;
  process.env.TRADEPILOT_DATA_DIR = "/unwritable-admin-directory";
  await applyMigrations(getPool());
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await bootstrapOwner(client, { companyName: slug, companySlug: slug, email, name: "Test Admin", password: initialPassword });
    await client.query("COMMIT");
    const row = (await client.query("SELECT id,company_id FROM users WHERE email=$1", [email])).rows[0];
    companyId = row.company_id; userId = row.id;
  } finally { client.release(); }
});
after(async () => {
  if (companyId) {
    await getPool().query("DELETE FROM audit_events WHERE company_id=$1", [companyId]);
    await getPool().query("DELETE FROM users WHERE company_id=$1", [companyId]);
    await getPool().query("DELETE FROM companies WHERE id=$1", [companyId]);
  }
  await closeDbPool();
  for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
  Object.assign(process.env, oldEnv);
});

test("deployment admin: bootstrap credentials and preferences come from PostgreSQL", async () => {
  const login = await verifyDeploymentAdmin(email, initialPassword);
  assert.equal(login?.name, "Test Admin");
  assert.equal(login?.mustChangePassword, true);
  assert.equal(await verifyDeploymentAdmin(email, "wrong"), null);
  await updateAccountProfile("deployment-admin", { name: "Updated Admin", locale: "en", timezone: "UTC" });
  await closeDbPool();
  assert.deepEqual(await getAccountProfile("deployment-admin"), { name: "Updated Admin", email, locale: "en", timezone: "UTC" });
});

test("deployment admin: concurrent profile/password writes preserve credentials; old JWTs are revoked", async () => {
  const before = await verifyDeploymentAdmin(email, initialPassword);
  assert.ok(before);
  await assert.rejects(() => changeAccountPassword("deployment-admin", "wrong-password", newPassword), /当前密码不正确/);
  await Promise.all([
    changeAccountPassword("deployment-admin", initialPassword, newPassword),
    updateAccountProfile("deployment-admin", { name: "Concurrent Admin", locale: "zh", timezone: "Asia/Shanghai" }),
  ]);
  assert.equal(await verifyDeploymentAdmin(email, initialPassword), null);
  const login = await verifyDeploymentAdmin(email, newPassword);
  assert.equal(login?.name, "Concurrent Admin");
  assert.equal(login?.mustChangePassword, false);
  assert.notEqual(login?.sessionVersion, before.sessionVersion);
  assert.equal((await getAuthSessionState("deployment-admin", before.sessionVersion)).active, false);
  assert.equal((await getAuthSessionState("deployment-admin", login!.sessionVersion)).isPlatformAdmin, true);
  const audit = await getPool().query("SELECT action FROM audit_events WHERE company_id=$1 AND action='account.password.change'", [companyId]);
  assert.equal(audit.rowCount, 1);
});

test("deployment admin: disabled accounts/workspaces and changed roles cannot fall back to environment password", async () => {
  await getPool().query("UPDATE users SET is_active=false WHERE id=$1", [userId]);
  await assert.rejects(() => verifyDeploymentAdmin(email, initialPassword));
  assert.equal((await getAuthSessionState("deployment-admin", "0")).active, false);
  await getPool().query("UPDATE users SET is_active=true,role='member' WHERE id=$1", [userId]);
  await assert.rejects(() => verifyDeploymentAdmin(email, initialPassword));
  await getPool().query("UPDATE users SET role='owner' WHERE id=$1", [userId]);
  await getPool().query("UPDATE companies SET is_active=false WHERE id=$1", [companyId]);
  await assert.rejects(() => verifyDeploymentAdmin(email, initialPassword));
  await getPool().query("UPDATE companies SET is_active=true WHERE id=$1", [companyId]);
});

test("deployment admin: missing DB identity never uses filesystem/environment credentials", async () => {
  process.env.TRADEPILOT_ADMIN_EMAIL = `missing-${email}`;
  try {
    assert.equal(await verifyDeploymentAdmin(process.env.TRADEPILOT_ADMIN_EMAIL!, "wrong-password"), null);
    await assert.rejects(() => getAccountProfile("deployment-admin"));
    assert.equal((await getAuthSessionState("deployment-admin", "0")).active, false);
  }
  finally { process.env.TRADEPILOT_ADMIN_EMAIL = email; }
});

test("deployment admin: only the correct strong credential bootstraps a missing owner, once", async () => {
  const temporaryEmail = `bootstrap-${email}`;
  const temporarySlug = `bootstrap-${slug}`;
  process.env.TRADEPILOT_ADMIN_EMAIL = temporaryEmail;
  process.env.TRADEPILOT_WORKSPACE_SLUG = temporarySlug;
  try {
    assert.equal(await verifyDeploymentAdmin(temporaryEmail, "wrong-password"), null);
    assert.equal((await getPool().query("SELECT id FROM users WHERE email=$1", [temporaryEmail])).rowCount, 0);
    const login = await verifyDeploymentAdmin(temporaryEmail, initialPassword);
    assert.equal(login?.mustChangePassword, true);
    assert.ok(login?.sessionVersion);
    await changeAccountPassword("deployment-admin", initialPassword, newPassword);
    assert.equal(await verifyDeploymentAdmin(temporaryEmail, initialPassword), null);
    assert.equal((await verifyDeploymentAdmin(temporaryEmail, newPassword))?.mustChangePassword, false);
  } finally {
    const id = (await getPool().query("SELECT id FROM companies WHERE slug=$1", [temporarySlug])).rows[0]?.id;
    if (id) {
      await getPool().query("DELETE FROM audit_events WHERE company_id=$1", [id]);
      await getPool().query("DELETE FROM users WHERE company_id=$1", [id]);
      await getPool().query("DELETE FROM companies WHERE id=$1", [id]);
    }
    process.env.TRADEPILOT_ADMIN_EMAIL = email;
    process.env.TRADEPILOT_WORKSPACE_SLUG = slug;
  }
});

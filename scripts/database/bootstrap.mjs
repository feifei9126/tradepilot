import { assertAdminCredentialPolicy } from "../security/admin-policy.mjs";
import { randomUUID } from "node:crypto";

async function hashPassword(password) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  const hex = value => Buffer.from(value).toString("hex");
  return `${hex(salt)}:${hex(bits)}`;
}

/** Call inside a transaction. Initialization never restores disabled accounts,
 * changes existing roles/names, or resets passwords implicitly. The lock order
 * matches web management/account writes, including concurrent initialization. */
export async function bootstrapOwner(client, { companyName, companySlug, email, name, password, resetPassword = false }) {
  email = email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid owner email is required");
  if (!companySlug || !companyName || !name) throw new Error("Workspace and owner names are required");
  await client.query(
    "INSERT INTO companies(name,slug) VALUES($1,$2) ON CONFLICT(slug) DO NOTHING",
    [companyName, companySlug],
  );
  const company = (await client.query("SELECT id FROM companies WHERE slug=$1", [companySlug])).rows[0];
  if (!company) throw new Error("Could not find bootstrap workspace");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [company.id]);
  await client.query("SELECT id FROM companies WHERE id=$1 FOR UPDATE", [company.id]);
  const existing = (await client.query("SELECT id,company_id,role FROM users WHERE email=$1 FOR UPDATE", [email])).rows[0];
  if (existing && (existing.company_id !== company.id || existing.role !== "owner")) {
    throw new Error("Bootstrap email already belongs to a different workspace or role; refusing to move or promote it");
  }
  if (!existing || resetPassword) {
    assertAdminCredentialPolicy({}, { ...process.env, TRADEPILOT_ADMIN_EMAIL: email, TRADEPILOT_ADMIN_PASSWORD: password });
    if (typeof password !== "string" || password.length < 8 || password.length > 128) throw new Error("Owner password must contain 8–128 characters");
    const settings = { passwordHash: await hashPassword(password), sessionVersion: randomUUID(), mustChangePassword: true };
    if (!existing) {
      const user = (await client.query(
        "INSERT INTO users(company_id,email,name,role,settings) VALUES($1,$2,$3,'owner',$4::jsonb) RETURNING id",
        [company.id, email, name, JSON.stringify(settings)],
      )).rows[0];
      await client.query("INSERT INTO audit_events(company_id,actor_id,action,target_id) VALUES($1,'bootstrap','account.bootstrap.create',$2)", [company.id, user.id]);
    } else {
      // Merge only password fields: preserve profile preferences and disable state.
      await client.query("UPDATE users SET settings=settings || $2::jsonb WHERE id=$1", [existing.id, JSON.stringify(settings)]);
      await client.query("INSERT INTO audit_events(company_id,actor_id,action,target_id) VALUES($1,'bootstrap','account.bootstrap.password_reset',$2)", [company.id, existing.id]);
    }
  }
  return { created: !existing, passwordReset: !existing || resetPassword };
}

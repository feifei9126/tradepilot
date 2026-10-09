import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { getDb, query, transaction } from "@/db";
import type { PoolClient } from "pg";
import { companies, users } from "@/db/schema";
import { assertAdminCredentialPolicy, assertAdminRecord, isStrongAdminPassword } from "../../scripts/security/admin-policy.mjs";
import { hashPassword, verifyPassword } from "@/lib/crypto";

export type AccountPreferences = { locale: "zh" | "en"; timezone: string };
export type AccountProfile = AccountPreferences & { name: string; email: string };
type AdminRecord = { name?: string; locale?: "zh" | "en"; timezone?: string; passwordHash?: string; sessionVersion?: string; mustChangePassword?: boolean };

export class AccountError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function deploymentCredentials() {
  const development = process.env.NODE_ENV !== "production";
  return {
    email: process.env.TRADEPILOT_ADMIN_EMAIL?.trim().toLowerCase() || (development ? "demo@tradepilot.dev" : ""),
    password: process.env.TRADEPILOT_ADMIN_PASSWORD || (development ? "12345678" : ""),
  };
}

function directory() {
  return process.env.TRADEPILOT_DATA_DIR || "data";
}

export async function readAdminRecord(dataDirectory = directory()): Promise<AdminRecord> {
  try {
    const value: unknown = JSON.parse(await readFile(join(dataDirectory, "admin-account.json"), "utf8"));
    assertAdminRecord(value);
    const record = value as AdminRecord;
    return record;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error; // Never fall back to the environment password when the saved record is corrupt.
  }
}

export async function saveAdminRecord(record: AdminRecord, dataDirectory = directory()) {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  const target = join(dataDirectory, "admin-account.json");
  const temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(record), { mode: 0o600, flag: "wx" });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export async function verifyDeploymentAdmin(email: string, password: string) {
  const configured = deploymentCredentials();
  if (!configured.email || email.trim().toLowerCase() !== configured.email) return null;
  const record = await readAdminRecord();
  assertAdminCredentialPolicy(record);
  if (process.env.NODE_ENV === "production" && record.passwordHash && !isStrongAdminPassword(password)) return null;
  const valid = record.passwordHash
    ? await verifyPassword(password, record.passwordHash)
    : Boolean(configured.password && password === configured.password);
  return valid ? { email: configured.email, name: record.name || "TradePilot Admin", sessionVersion: record.sessionVersion || "0", mustChangePassword: record.mustChangePassword === true || (process.env.NODE_ENV === "production" && !record.passwordHash) } : null;
}

function preferences(settings: unknown): AccountPreferences {
  const value = settings && typeof settings === "object" ? settings as Record<string, unknown> : {};
  return {
    locale: value.locale === "en" ? "en" : "zh",
    timezone: typeof value.timezone === "string" && value.timezone ? value.timezone : "Asia/Shanghai",
  };
}

async function registeredUser(id: string) {
  const db = await getDb();
  if (!db) throw new AccountError("数据库未配置，无法读取该账号", 503);
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user || user.isActive !== true) throw new AccountError("账号不存在或已停用", 404);
  const [company] = await db.select({ isActive: companies.isActive }).from(companies).where(eq(companies.id, user.companyId)).limit(1);
  if (!company || company.isActive !== true) throw new AccountError("工作区不存在或已停用", 404);
  return { db, user };
}

export async function getAccountProfile(id: string): Promise<AccountProfile> {
  if (id === "deployment-admin") {
    const record = await readAdminRecord();
    return {
      name: record.name || "TradePilot Admin",
      email: deploymentCredentials().email,
      ...preferences(record),
    };
  }
  const { user } = await registeredUser(id);
  return { name: user.name, email: user.email, ...preferences(user.settings) };
}

type LockedUser = { id: string; company_id: string; name: string; email: string; settings: Record<string, unknown> };
async function writeRegisteredAccount<T>(id: string, fn: (client: PoolClient, user: LockedUser) => Promise<T>) {
  const identity = await query("SELECT company_id FROM users WHERE id=$1", [id]);
  const companyId = identity.rows[0]?.company_id;
  if (!companyId) throw new AccountError("账号不存在或已停用", 404);
  return transaction(async client => {
    // Same lock order as team management, workspace suspension and CRM writes.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [companyId]);
    const result = await client.query(`SELECT u.* FROM users u JOIN companies c ON c.id=u.company_id
      WHERE u.id=$1 AND u.company_id=$2 AND u.is_active=true AND c.is_active=true
      FOR UPDATE OF u FOR SHARE OF c`, [id, companyId]);
    if (!result.rows[0]) throw new AccountError("账号或工作区已停用", 403);
    return fn(client, result.rows[0]);
  });
}

export async function updateAccountProfile(id: string, input: Pick<AccountProfile, "name" | "locale" | "timezone">) {
  const name = input.name.trim();
  if (!name || name.length > 100 || !["zh", "en"].includes(input.locale)) throw new AccountError("个人资料格式不正确");
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); } catch { throw new AccountError("时区格式不正确"); }
  if (id === "deployment-admin") {
    await saveAdminRecord({ ...await readAdminRecord(), ...input, name });
  } else {
    await writeRegisteredAccount(id, async (client, user) => {
      // Merge inside SQL, not from a pre-lock snapshot that could resurrect a
      // reset password or an old sessionVersion during a concurrent update.
      await client.query("UPDATE users SET name=$2,settings=settings || $3::jsonb WHERE id=$1", [id, name, JSON.stringify({ locale: input.locale, timezone: input.timezone })]);
      await client.query("INSERT INTO audit_events(company_id,actor_id,action,target_id) VALUES($1,$2,'account.profile.update',$2)", [user.company_id, id]);
    });
  }
  return getAccountProfile(id);
}

export async function changeAccountPassword(id: string, currentPassword: string, newPassword: string) {
  if (process.env.NODE_ENV === "production" && !isStrongAdminPassword(newPassword)) throw new AccountError("新密码至少 16 位，包含两类字符且不能使用明显弱密码");
  if (newPassword.length < 8 || newPassword.length > 128) throw new AccountError("新密码需要 8–128 个字符");
  if (currentPassword === newPassword) throw new AccountError("新密码不能与当前密码相同");
  if (id === "deployment-admin") {
    const record = await readAdminRecord();
    const valid = record.passwordHash
      ? await verifyPassword(currentPassword, record.passwordHash)
      : Boolean(deploymentCredentials().password && currentPassword === deploymentCredentials().password);
    if (!valid) throw new AccountError("当前密码不正确", 403);
    await saveAdminRecord({ ...record, passwordHash: await hashPassword(newPassword), sessionVersion: randomBytes(16).toString("hex"), mustChangePassword: false });
  } else {
    await writeRegisteredAccount(id, async (client, user) => {
      const settings = user.settings || {};
      if (typeof settings.passwordHash !== "string" || !(await verifyPassword(currentPassword, settings.passwordHash))) throw new AccountError("当前密码不正确", 403);
      await client.query("UPDATE users SET settings=settings || $2::jsonb WHERE id=$1", [id, JSON.stringify({ passwordHash: await hashPassword(newPassword), sessionVersion: randomBytes(16).toString("hex"), mustChangePassword: false })]);
      await client.query("INSERT INTO audit_events(company_id,actor_id,action,target_id) VALUES($1,$2,'account.password.change',$2)", [user.company_id, id]);
    });
  }
}


export type AuthSessionState = {
  active: boolean;
  name?: string;
  companyId?: string;
  role?: string;
  isDeploymentWorkspace?: boolean;
  mustChangePassword?: boolean;
  isPlatformAdmin?: boolean;
  databaseUnavailable?: boolean;
};

/** Re-check JWTs against the authoritative account record so disabling a user,
 * changing their role, or changing their password revokes existing sessions. */
export async function getAuthSessionState(id: string, sessionVersion: string): Promise<AuthSessionState> {
  if (id === "deployment-admin") {
    try {
      const configured = deploymentCredentials();
      const record = await readAdminRecord();
      assertAdminCredentialPolicy(record);
      const version = record.sessionVersion || "0";
      return { active: Boolean(configured.email && version === sessionVersion), name: record.name || "TradePilot Admin", companyId: "deployment-workspace", role: "owner", isDeploymentWorkspace: true, isPlatformAdmin: true, mustChangePassword: record.mustChangePassword === true || (process.env.NODE_ENV === "production" && !record.passwordHash) };
    } catch {
      return { active: false };
    }
  }

  try {
    const db = await getDb();
    if (!db) return { active: false, databaseUnavailable: true };
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      companyId: users.companyId,
      role: users.role,
      userActive: users.isActive,
      settings: users.settings,
      companyActive: companies.isActive,
      companySlug: companies.slug,
    }).from(users).innerJoin(companies, eq(users.companyId, companies.id)).where(eq(users.id, id)).limit(1);
    if (!user || user.userActive !== true || user.companyActive !== true) return { active: false };
    const settings = user.settings && typeof user.settings === "object" ? user.settings as Record<string, unknown> : {};
    const currentVersion = typeof settings.sessionVersion === "string" ? settings.sessionVersion : "0";
    if (currentVersion !== sessionVersion) return { active: false };
    return {
      active: true,
      name: user.name,
      companyId: user.companyId,
      role: user.role || "member",
      isDeploymentWorkspace: user.companySlug === (process.env.TRADEPILOT_WORKSPACE_SLUG?.trim() || "tradepilot-admin"),
      isPlatformAdmin: false,
      mustChangePassword: settings.mustChangePassword === true,
    };
  } catch {
    return { active: false, databaseUnavailable: true };
  }
}

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { companies as companiesTable, users as usersTable } from "@/db/schema";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "@/lib/crypto";
import { isRegistrationPasswordAllowed } from "@/lib/registration-policy";

interface CreateUserResult {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    companyId: string;
    role: string;
  };
}

interface FindUserResult {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: string;
  sessionVersion: string;
  isDeploymentWorkspace: boolean;
  mustChangePassword: boolean;
  isPlatformAdmin: boolean;
}

function workspaceSlug() {
  return process.env.TRADEPILOT_WORKSPACE_SLUG?.trim() || "tradepilot-admin";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function companySlug(company: string) {
  const base = company
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "workspace"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createUser(
  company: string,
  name: string,
  email: string,
  password: string,
): Promise<CreateUserResult> {
  const db = await getDb();
  if (!db) return { ok: false, error: "数据库未配置，暂时无法注册" };

  const normalizedCompany = company.trim();
  const normalizedName = name.trim();
  const normalizedEmail = normalizeEmail(email);

  if (
    !normalizedCompany ||
    normalizedCompany.length > 120 ||
    !normalizedName ||
    normalizedName.length > 80 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    !isRegistrationPasswordAllowed(password)
  ) {
    return { ok: false, error: "注册信息格式不正确" };
  }

  try {
    const passwordHash = await hashPassword(password);
    // Company and owner creation must be atomic. Otherwise a failed user
    // insert can leave an orphaned workspace that is never usable or cleaned
    // up by a later registration attempt.
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, normalizedEmail))
        .limit(1);
      if (existing.length > 0) {
        return { ok: false, error: "该邮箱已被注册" };
      }

      const [newCompany] = await tx
        .insert(companiesTable)
        .values({ name: normalizedCompany, slug: companySlug(normalizedCompany) })
        .returning();
      if (!newCompany) return { ok: false, error: "工作区创建失败" };

      const [newUser] = await tx
        .insert(usersTable)
        .values({
          companyId: newCompany.id,
          email: normalizedEmail,
          name: normalizedName,
          role: "owner",
          settings: { passwordHash, sessionVersion: crypto.randomUUID() },
        })
        .returning();
      if (!newUser || !newUser.companyId) {
        return { ok: false, error: "账号创建失败" };
      }

      return {
        ok: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          companyId: newUser.companyId,
          role: newUser.role || "owner",
        },
      };
    });
  } catch {
    return { ok: false, error: "注册服务暂时不可用" };
  }
}

export async function findUserByCredentials(
  email: string,
  password: string,
): Promise<FindUserResult | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        companyId: usersTable.companyId,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        isActive: usersTable.isActive,
        settings: usersTable.settings,
        companyActive: companiesTable.isActive,
        companySlug: companiesTable.slug,
      })
      .from(usersTable)
      .innerJoin(companiesTable, eq(usersTable.companyId, companiesTable.id))
      .where(eq(usersTable.email, normalizeEmail(email)))
      .limit(1);
    const settings = user?.settings as { passwordHash?: unknown; sessionVersion?: unknown; mustChangePassword?: unknown } | null;
    const passwordHash = settings?.passwordHash;
    const validHash = typeof passwordHash === "string" && /^[0-9a-f]{32}:[0-9a-f]{64}$/i.test(passwordHash);
    // Missing, disabled and corrupt accounts perform the same expensive KDF.
    const verified = await verifyPassword(password, validHash ? passwordHash : DUMMY_PASSWORD_HASH);
    if (!user?.companyId || user.isActive !== true || user.companyActive !== true || !validHash || !verified) return null;

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      role: user.role || "member",
      sessionVersion: typeof settings?.sessionVersion === "string" ? settings.sessionVersion : "0",
      isDeploymentWorkspace: user.companySlug === workspaceSlug(),
      isPlatformAdmin: false,
      mustChangePassword: settings?.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}

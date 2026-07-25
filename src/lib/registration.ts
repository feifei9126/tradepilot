import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { companies as companiesTable, users as usersTable } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/crypto";

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
  const db = getDb();
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
    password.length < 8 ||
    password.length > 128
  ) {
    return { ok: false, error: "注册信息格式不正确" };
  }

  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);
    if (existing.length > 0) {
      return { ok: false, error: "该邮箱已被注册" };
    }

    const passwordHash = await hashPassword(password);
    const [newCompany] = await db
      .insert(companiesTable)
      .values({ name: normalizedCompany, slug: companySlug(normalizedCompany) })
      .returning();
    if (!newCompany) return { ok: false, error: "工作区创建失败" };

    const [newUser] = await db
      .insert(usersTable)
      .values({
        companyId: newCompany.id,
        email: normalizedEmail,
        name: normalizedName,
        role: "owner",
        settings: { passwordHash },
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
  } catch {
    return { ok: false, error: "注册服务暂时不可用" };
  }
}

export async function findUserByCredentials(
  email: string,
  password: string,
): Promise<FindUserResult | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizeEmail(email)))
      .limit(1);
    if (!user?.companyId) return null;

    const settings = user.settings as { passwordHash?: unknown } | null;
    const passwordHash = settings?.passwordHash;
    if (
      typeof passwordHash !== "string" ||
      !(await verifyPassword(password, passwordHash))
    ) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      role: user.role || "member",
    };
  } catch {
    return null;
  }
}

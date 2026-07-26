import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { companies as companiesTable, users as usersTable } from "@/db/schema";
import { BusinessError } from "@/lib/business/errors";
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

function databaseErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "UNKNOWN";
  if ("code" in error) return String(error.code);
  if ("cause" in error) return databaseErrorCode(error.cause);
  return "UNKNOWN";
}

function logDatabaseFailure(operation: "register" | "authorize", error: unknown) {
  console.error(
    `[auth:${operation}] DATABASE_UNAVAILABLE (${databaseErrorCode(error)})`,
  );
}

export async function createUser(
  company: string,
  name: string,
  email: string,
  password: string,
): Promise<CreateUserResult> {
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
    const db = getDb();
    if (!db) return { ok: false, error: "数据库未配置，暂时无法注册" };
    const passwordHash = await hashPassword(password);
    const newUser = await db.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, normalizedEmail))
        .limit(1);
      if (existing) return null;

      const [newCompany] = await transaction
        .insert(companiesTable)
        .values({
          name: normalizedCompany,
          slug: companySlug(normalizedCompany),
        })
        .returning();
      if (!newCompany) {
        throw new BusinessError("DATABASE_UNAVAILABLE", "工作区创建失败", 503);
      }
      const [created] = await transaction
        .insert(usersTable)
        .values({
          companyId: newCompany.id,
          email: normalizedEmail,
          name: normalizedName,
          role: "owner",
          settings: { passwordHash },
        })
        .returning();
      return created;
    });
    if (!newUser) return { ok: false, error: "该邮箱已被注册" };
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
  } catch (error) {
    if (databaseErrorCode(error) === "23505") {
      return { ok: false, error: "该邮箱已被注册" };
    }
    logDatabaseFailure("register", error);
    return { ok: false, error: "注册服务暂时不可用" };
  }
}

export async function findUserByCredentials(
  email: string,
  password: string,
): Promise<FindUserResult | null> {
  try {
    const db = getDb();
    if (!db) {
      throw new BusinessError(
        "DATABASE_NOT_CONFIGURED",
        "数据库未配置",
        503,
      );
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizeEmail(email)))
      .limit(1);
    if (!user?.companyId || user.isActive === false) return null;

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
  } catch (error) {
    if (error instanceof BusinessError) throw error;
    logDatabaseFailure("authorize", error);
    throw new BusinessError(
      "DATABASE_UNAVAILABLE",
      "数据库认证服务暂时不可用",
      503,
      { cause: error },
    );
  }
}

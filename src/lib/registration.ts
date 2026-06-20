import { hashPassword, verifyPassword } from "@/lib/crypto";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { users as usersTable, companies as companiesTable } from "@/db/schema";

// Fixed admin account credentials (hardcoded, always available)
const ADMIN_EMAIL = "25695546@qq.com";
const ADMIN_PASSWORD = "Feifei9126~";

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

export async function createUser(
  company: string,
  name: string,
  email: string,
  password: string
): Promise<CreateUserResult> {
  // Prevent re-creating the admin account
  if (email === ADMIN_EMAIL) {
    return { ok: false, error: "该邮箱已被注册" };
  }

  // Database is required for registration (in-memory fallback removed - Workers don't persist it)
  const db = getDb();
  if (!db) {
    return { ok: false, error: "数据库未配置，暂时无法注册" };
  }

  try {
    // Check if email already exists
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (existing.length > 0) {
      return { ok: false, error: "该邮箱已被注册" };
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create company
    const [newCompany] = await db
      .insert(companiesTable)
      .values({
        name: company,
        slug: company.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      })
      .returning();

    // Create user
    const [newUser] = await db
      .insert(usersTable)
      .values({
        companyId: newCompany.id,
        email,
        name,
        role: "owner",
      })
      .returning();

    // Store password hash in user settings
    await db
      .update(usersTable)
      .set({ settings: { passwordHash } as any })
      .where(eq(usersTable.id, newUser.id));

    return {
      ok: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        companyId: newUser.companyId!,
        role: newUser.role || "owner",
      },
    };
  } catch (e: any) {
    return { ok: false, error: e.message || "注册失败" };
  }
}

export async function findUserByCredentials(
  email: string,
  password: string
): Promise<FindUserResult | null> {
  // 1. Check hardcoded demo account
  if (email === "demo@tradepilot.dev" && password === "12345678") {
    return {
      id: "1",
      email,
      name: "Demo User",
      companyId: "1",
      role: "owner",
    };
  }

  // 2. Check hardcoded admin account
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return {
      id: "admin-001",
      email: ADMIN_EMAIL,
      name: "Admin",
      companyId: "admin-company",
      role: "owner",
    };
  }

  // 3. Check database
  const db = getDb();
  if (db) {
    try {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (user) {
        const storedHash = (user.settings as any)?.passwordHash;
        if (storedHash && (await verifyPassword(password, storedHash))) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            companyId: user.companyId!,
            role: user.role || "member",
          };
        }
      }
    } catch {
      // DB lookup failed - return null (don't fall through to non-persistent storage)
      return null;
    }
  }

  return null;
}

import { store, type StoredUser, type StoredCompany } from "@/lib/store";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";

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
  const db = getDb();
  if (db) {
    try {
      const { users: usersTable, companies: companiesTable } = await import("@/db/schema");
      const existingDb = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (existingDb.length > 0) {
        return { ok: false, error: "该邮箱已被注册" };
      }

      const passwordHash = await hashPassword(password);

      const [newCompany] = await db
        .insert(companiesTable)
        .values({
          name: company,
          slug: company.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        })
        .returning();

      const [newUser] = await db
        .insert(usersTable)
        .values({
          companyId: newCompany.id,
          email,
          name,
          role: "owner",
        })
        .returning();

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

  // Fallback: in-memory store
  const existing = store.users.findByEmail(email);
  if (existing) {
    return { ok: false, error: "该邮箱已被注册" };
  }

  const companyId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  store.companies.create({
    id: companyId,
    name: company,
    slug: company.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    createdAt: new Date().toISOString(),
  });

  const userId = crypto.randomUUID();
  store.users.create({
    id: userId,
    companyId,
    email,
    name,
    password: passwordHash,
    role: "owner",
    createdAt: new Date().toISOString(),
  });

  return {
    ok: true,
    user: { id: userId, email, name, companyId, role: "owner" },
  };
}

export async function findUserByCredentials(
  email: string,
  password: string
): Promise<FindUserResult | null> {
  // Check demo account first
  if (email === "demo@tradepilot.dev" && password === "password") {
    return {
      id: "1",
      email,
      name: "Demo User",
      companyId: "1",
      role: "owner",
    };
  }

  const db = getDb();
  if (db) {
    try {
      const { users: usersTable } = await import("@/db/schema");
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
      // DB check failed, fall through to in-memory
    }
  }

  // Fallback: in-memory store
  const user = store.users.findByEmail(email);
  if (user) {
    const valid = await verifyPassword(password, user.password);
    if (valid) {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: user.companyId,
        role: user.role,
      };
    }
  }

  return null;
}

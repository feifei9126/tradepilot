import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.TRADEPILOT_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.TRADEPILOT_ADMIN_PASSWORD;
const seedDemo = process.env.TRADEPILOT_SEED_DEMO === "true";

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if ((!adminEmail || !adminPassword) && !seedDemo) {
  console.error(
    "Set TRADEPILOT_ADMIN_EMAIL and TRADEPILOT_ADMIN_PASSWORD, or explicitly enable TRADEPILOT_SEED_DEMO=true",
  );
  process.exit(1);
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const toHex = (value) =>
    Array.from(value)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  return `${toHex(salt)}:${toHex(new Uint8Array(derived))}`;
}

async function upsertAccount(
  sql,
  { companyName, companySlug, email, name, password },
) {
  const [company] = await sql`
    INSERT INTO companies (id, name, slug)
    VALUES (gen_random_uuid(), ${companyName}, ${companySlug})
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  const passwordHash = await hashPassword(password);
  await sql`
    INSERT INTO users (id, company_id, email, name, role, settings)
    VALUES (
      gen_random_uuid(),
      ${company.id},
      ${email},
      ${name},
      'owner',
      ${JSON.stringify({ passwordHash })}::jsonb
    )
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      company_id = EXCLUDED.company_id,
      settings = EXCLUDED.settings
  `;
}

async function main() {
  const sql = neon(databaseUrl);

  await sql`CREATE TABLE IF NOT EXISTS companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    slug varchar(100) UNIQUE NOT NULL,
    logo_url text,
    timezone varchar(50) DEFAULT 'Asia/Shanghai',
    currency varchar(3) DEFAULT 'CNY',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES companies(id) NOT NULL,
    email varchar(255) UNIQUE NOT NULL,
    name varchar(100) NOT NULL,
    role varchar(20) DEFAULT 'member',
    avatar_url text,
    settings jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT NOW()
  )`;

  if (adminEmail && adminPassword) {
    await upsertAccount(sql, {
      companyName: "TradePilot Admin",
      companySlug: "tradepilot-admin",
      email: adminEmail,
      name: "Admin",
      password: adminPassword,
    });
    console.log(`Admin account initialized: ${adminEmail}`);
  }

  if (seedDemo) {
    await upsertAccount(sql, {
      companyName: "TradePilot Demo",
      companySlug: "tradepilot-demo",
      email: "demo@tradepilot.dev",
      name: "Demo User",
      password: "12345678",
    });
    console.log("Demo account initialized: demo@tradepilot.dev");
  }

  console.log("TradePilot database initialization complete");
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Database initialization failed",
  );
  process.exit(1);
});

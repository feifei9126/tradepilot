import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const ADMIN_EMAIL = "25695546@qq.com";
const ADMIN_PASSWORD = "Feifei9126~";
const DEMO_EMAIL = "demo@tradepilot.dev";
const DEMO_PASSWORD = "12345678";

async function main() {
  const sql = neon(DATABASE_URL);
  console.log("🔌 Connected to Neon");

  // Create tables
  console.log("📦 Creating tables...");
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
  
  await sql`CREATE TABLE IF NOT EXISTS contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES companies(id),
    name varchar(255) NOT NULL,
    email varchar(255),
    phone varchar(50),
    country varchar(100),
    source varchar(50),
    tags jsonb DEFAULT '[]',
    notes text,
    grade varchar(10),
    stage varchar(50),
    created_at timestamp with time zone DEFAULT NOW()
  )`;
  
  console.log("✅ Tables created");

  // Seed admin company
  const [adminCompany] = await sql`
    INSERT INTO companies (id, name, slug) 
    VALUES (gen_random_uuid(), 'TradePilot Admin', 'tradepilot-admin')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  console.log("🏢 Admin company:", adminCompany.id);

  // Seed admin user
  const adminHash = await simpleHash(ADMIN_PASSWORD);
  const [adminUser] = await sql`
    INSERT INTO users (id, company_id, email, name, role, settings)
    VALUES (gen_random_uuid(), ${adminCompany.id}, ${ADMIN_EMAIL}, 'Admin', 'owner', ${JSON.stringify({ passwordHash: adminHash })})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, email
  `;
  console.log("👤 Admin user:", adminUser.email);

  // Seed demo company
  const [demoCompany] = await sql`
    INSERT INTO companies (id, name, slug) 
    VALUES (gen_random_uuid(), 'Demo Company', 'demo-company')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  console.log("🏢 Demo company:", demoCompany.id);

  // Seed demo user
  const demoHash = await simpleHash(DEMO_PASSWORD);
  const [demoUser] = await sql`
    INSERT INTO users (id, company_id, email, name, role, settings)
    VALUES (gen_random_uuid(), ${demoCompany.id}, ${DEMO_EMAIL}, 'Demo User', 'owner', ${JSON.stringify({ passwordHash: demoHash })})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, email
  `;
  console.log("👤 Demo user:", demoUser.email);
  
  // Count
  const [count] = await sql`SELECT COUNT(*) as u FROM users`;
  console.log(`📊 Total users: ${count.u}`);
  console.log("🎉 Database setup complete!");
}

async function simpleHash(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  const hash = new Uint8Array(derived);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hash).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

main().catch(e => {
  console.error("❌", e.message);
  process.exit(1);
});

/**
 * Neon Database Setup + Seed Script
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/setup-db.ts
 *
 * This script will:
 *   1. Push Drizzle schema to Neon (creates all tables)
 *   2. Seed the unified admin account
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hashPassword } from "../src/lib/crypto.js";
import * as schema from "../src/db/schema/index.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  console.error("   Usage: DATABASE_URL=postgresql://... npx tsx scripts/setup-db.ts");
  process.exit(1);
}

const ADMIN_EMAIL = "25695546@qq.com";
const ADMIN_PASSWORD = "Feifei9126~";
const ADMIN_NAME = "Admin";
const ADMIN_COMPANY = "TradePilot Admin";

async function main() {
  console.log("🔌 Connecting to Neon database...");
  const sql = neon(DATABASE_URL);
  const db = drizzle(sql, { schema });

  // Step 1: Create tables via Drizzle push (uses drizzle-kit internally)
  console.log("📦 Creating tables...");
  try {
    // Use drizzle-kit to push schema
    const { execSync } = await import("child_process");
    execSync("npx drizzle-kit push", {
      env: { ...process.env, DATABASE_URL },
      stdio: "inherit",
    });
    console.log("✅ Tables created successfully");
  } catch (e: any) {
    console.log("⚠️  drizzle-kit push failed, trying direct table creation...");
    // Fallback: create tables directly if they don"t exist
    await createTablesDirectly(sql);
  }

  // Step 2: Seed admin account
  console.log("👤 Seeding admin account...");
  const existingUsers = await sql`SELECT id FROM users WHERE email = ${ADMIN_EMAIL}`;
  if (existingUsers.length > 0) {
    console.log("ℹ️  Admin account already exists, skipping");
  } else {
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    
    // Create company
    const [company] = await sql`
      INSERT INTO companies (id, name, slug, created_at)
      VALUES (gen_random_uuid(), ${ADMIN_COMPANY}, 'tradepilot-admin', NOW())
      RETURNING id
    `;

    // Create user
    const [user] = await sql`
      INSERT INTO users (id, company_id, email, name, role, settings, created_at)
      VALUES (gen_random_uuid(), ${company.id}, ${ADMIN_EMAIL}, ${ADMIN_NAME}, 'owner', ${JSON.stringify({ passwordHash })}::jsonb, NOW())
      RETURNING id, email, name, role
    `;

    console.log(`✅ Admin account created: ${user.email} (${user.name}, role: ${user.role})`);
  }

  // Verify
  const userCount = await sql`SELECT COUNT(*) as count FROM users`;
  const companyCount = await sql`SELECT COUNT(*) as count FROM companies`;
  console.log(`📊 Database summary: ${companyCount[0].count} companies, ${userCount[0].count} users`);
  console.log("🎉 Setup complete!");
}

async function createTablesDirectly(sql: any) {
  // Create tables if they don"t exist (simplified schema matching drizzle definitions)
  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(255) NOT NULL,
      slug varchar(100) UNIQUE NOT NULL,
      logo_url text,
      timezone varchar(50) DEFAULT 'Asia/Shanghai',
      currency varchar(3) DEFAULT 'CNY',
      is_active boolean DEFAULT true,
      created_at timestamp with time zone DEFAULT NOW(),
      updated_at timestamp with time zone DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
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
    )
  `;
  // Add other tables as needed - contacts, products, etc.
  console.log("✅ Base tables created");
}

main().catch((e) => {
  console.error("❌ Setup failed:", e.message);
  process.exit(1);
});

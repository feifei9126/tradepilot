import assert from "node:assert/strict";
import test from "node:test";

import type { Sql } from "postgres";

import { withCleanDatabase } from "../helpers/database";

const databaseUrl = process.env.TRADEPILOT_TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("TRADEPILOT_TEST_DATABASE_URL is required for migration tests");
}

const coreTables = [
  "companies",
  "users",
  "contacts",
  "contact_persons",
  "products",
  "inquiries",
  "quotations",
  "orders",
  "order_milestones",
  "shipments",
  "documents",
  "communications",
  "document_sequences",
  "organization_memberships",
  "organization_invitations",
];

async function existingTables(sql: Sql) {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
    ORDER BY table_name
  `;
  return rows.map((row) => row.table_name);
}

async function indexNames(sql: Sql) {
  const rows = await sql<{ indexname: string }[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
  `;
  return new Set(rows.map((row) => row.indexname));
}

async function constraintDefinitions(sql: Sql) {
  const rows = await sql<{ conname: string; definition: string }[]>`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint AS c
    JOIN pg_namespace AS namespace ON namespace.oid = c.connamespace
    WHERE namespace.nspname = current_schema()
  `;
  return new Map(rows.map((row) => [row.conname, row.definition]));
}

test("migrates an empty database with tenant-safe constraints", async () => {
  await withCleanDatabase(databaseUrl, async ({ sql, migrate }) => {
    await migrate();

    const tables = await existingTables(sql);
    for (const tableName of coreTables) {
      assert.ok(tables.includes(tableName), `missing table ${tableName}`);
    }

    const indexes = await indexNames(sql);
    for (const indexName of [
      "contacts_company_id_id_unique",
      "products_company_id_id_unique",
      "inquiries_company_id_id_unique",
      "quotations_company_id_id_unique",
      "quotations_company_no_unique",
      "orders_company_id_id_unique",
      "orders_company_no_unique",
      "orders_company_quotation_unique",
      "shipments_company_id_id_unique",
      "shipments_company_order_unique",
      "documents_company_id_id_unique",
      "documents_company_order_type_unique",
      "organization_invitations_token_hash_unique",
      "organization_memberships_user_status_idx",
      "organization_memberships_company_role_idx",
    ]) {
      assert.ok(indexes.has(indexName), `missing index ${indexName}`);
    }

    const constraints = await constraintDefinitions(sql);
    assert.match(
      constraints.get("contact_persons_company_contact_fk") || "",
      /FOREIGN KEY \(company_id, contact_id\) REFERENCES contacts\(company_id, id\)/,
    );
    assert.match(
      constraints.get("orders_company_quotation_fk") || "",
      /FOREIGN KEY \(company_id, quotation_id\) REFERENCES quotations\(company_id, id\)/,
    );
    assert.match(
      constraints.get("shipments_company_order_fk") || "",
      /FOREIGN KEY \(company_id, order_id\) REFERENCES orders\(company_id, id\)/,
    );
    assert.match(
      constraints.get("documents_company_shipment_fk") || "",
      /FOREIGN KEY \(company_id, shipment_id\) REFERENCES shipments\(company_id, id\)/,
    );
  });
});

test("upgrades the legacy account schema without losing users", async () => {
  await withCleanDatabase(databaseUrl, async ({ sql, migrate }) => {
    await sql`
      CREATE TABLE companies (
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
      CREATE TABLE users (
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

    const companyId = "30000000-0000-4000-8000-000000000001";
    const userId = "30000000-0000-4000-8000-000000000002";
    await sql`
      INSERT INTO companies (id, name, slug)
      VALUES (${companyId}, 'Legacy Company', 'legacy-company')
    `;
    await sql`
      INSERT INTO users (id, company_id, email, name, role)
      VALUES (${userId}, ${companyId}, 'owner@example.com', 'Legacy Owner', 'owner')
    `;

    await migrate();

    const [user] = await sql<{ id: string; company_id: string; email: string }[]>`
      SELECT id, company_id, email FROM users WHERE id = ${userId}
    `;
    assert.deepEqual(user, {
      id: userId,
      company_id: companyId,
      email: "owner@example.com",
    });

    const [membership] = await sql<
      { company_id: string; user_id: string; role: string; status: string }[]
    >`
      SELECT company_id, user_id, role, status
      FROM organization_memberships
      WHERE company_id = ${companyId} AND user_id = ${userId}
    `;
    assert.deepEqual(membership, {
      company_id: companyId,
      user_id: userId,
      role: "owner",
      status: "active",
    });

    const tables = await existingTables(sql);
    for (const tableName of coreTables) {
      assert.ok(tables.includes(tableName), `missing table ${tableName}`);
    }
  });
});

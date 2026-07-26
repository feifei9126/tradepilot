import assert from "node:assert/strict";
import test from "node:test";

import { verifyPassword } from "../../src/lib/crypto";
import { bootstrapAdmin } from "../../scripts/db/bootstrap.mjs";
import { seedDemoData } from "../../scripts/db/seed.mjs";
import { withCleanDatabase } from "../helpers/database";

const databaseUrl = process.env.TRADEPILOT_TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("TRADEPILOT_TEST_DATABASE_URL is required for bootstrap tests");
}

test("bootstrap is idempotent and safely rotates the admin password", async () => {
  await withCleanDatabase(databaseUrl, async ({ databaseUrl, sql, migrate }) => {
    await migrate();
    const logs: string[] = [];
    const firstPassword = "first-strong-password-123";
    const secondPassword = "second-strong-password-456";

    const first = await bootstrapAdmin({
      databaseUrl,
      email: "ADMIN@Example.com",
      password: firstPassword,
      log: (message) => logs.push(message),
    });
    const second = await bootstrapAdmin({
      databaseUrl,
      email: "admin@example.com",
      password: secondPassword,
      log: (message) => logs.push(message),
    });

    assert.equal(second.companyId, first.companyId);
    assert.equal(second.userId, first.userId);

    const [{ count: companyCount }] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM companies
    `;
    const [{ count: userCount }] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM users
    `;
    assert.equal(companyCount, 1);
    assert.equal(userCount, 1);

    const [user] = await sql<{
      company_id: string;
      id: string;
      settings: { passwordHash?: string };
    }[]>`
      SELECT id, company_id, settings
      FROM users
      WHERE email = 'admin@example.com'
    `;
    assert.equal(user.id, first.userId);
    assert.equal(user.company_id, first.companyId);
    assert.equal(
      await verifyPassword(secondPassword, user.settings.passwordHash || ""),
      true,
    );
    assert.equal(
      await verifyPassword(firstPassword, user.settings.passwordHash || ""),
      false,
    );

    const output = logs.join("\n");
    assert.doesNotMatch(output, new RegExp(firstPassword));
    assert.doesNotMatch(output, new RegExp(secondPassword));
  });
});

test("demo seed is a no-op unless explicitly enabled", async () => {
  await withCleanDatabase(databaseUrl, async ({ databaseUrl, sql, migrate }) => {
    await migrate();
    await bootstrapAdmin({
      databaseUrl,
      email: "admin@example.com",
      password: "strong-password-123",
      log: () => undefined,
    });

    const logs: string[] = [];
    const result = await seedDemoData({
      databaseUrl,
      enabled: false,
      log: (message) => logs.push(message),
    });
    assert.equal(result.seeded, false);
    assert.match(logs.join("\n"), /未启用/);

    const [{ count }] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM contacts
    `;
    assert.equal(count, 0);
  });
});

test("demo seed populates core business records idempotently", async () => {
  await withCleanDatabase(databaseUrl, async ({ databaseUrl, sql, migrate }) => {
    await migrate();
    await bootstrapAdmin({
      databaseUrl,
      email: "admin@example.com",
      password: "strong-password-123",
      log: () => undefined,
    });

    await seedDemoData({
      databaseUrl,
      enabled: true,
      adminEmail: "admin@example.com",
      log: () => undefined,
    });
    await seedDemoData({
      databaseUrl,
      enabled: true,
      adminEmail: "admin@example.com",
      log: () => undefined,
    });

    for (const tableName of [
      "contacts",
      "products",
      "inquiries",
      "quotations",
      "orders",
      "shipments",
      "documents",
    ]) {
      const [{ count }] = await sql.unsafe<{ count: number }[]>(
        `SELECT count(*)::int AS count FROM ${tableName}`,
      );
      assert.equal(count, 1, `${tableName} should contain one demo row`);
    }
  });
});

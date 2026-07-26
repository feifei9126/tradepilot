import assert from "node:assert/strict";
import test from "node:test";

import { bootstrapAdmin } from "../../scripts/db/bootstrap.mjs";
import { getDatabaseStatus } from "../../scripts/db/status.mjs";
import { withCleanDatabase } from "../helpers/database";

const databaseUrl = process.env.TRADEPILOT_TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("TRADEPILOT_TEST_DATABASE_URL is required for health tests");
}

test("database status reports migration and bootstrap state", async () => {
  await withCleanDatabase(databaseUrl, async ({ databaseUrl, migrate }) => {
    const connectionString = databaseUrl;

    assert.deepEqual(await getDatabaseStatus({ databaseUrl: connectionString }), {
      database: "connected",
      migrations: "outdated",
      bootstrapRequired: true,
    });

    await migrate();
    assert.deepEqual(await getDatabaseStatus({ databaseUrl: connectionString }), {
      database: "connected",
      migrations: "current",
      bootstrapRequired: true,
    });

    await bootstrapAdmin({
      databaseUrl: connectionString,
      email: "owner@example.com",
      password: "strong-password-123",
      log: () => undefined,
    });
    assert.deepEqual(await getDatabaseStatus({ databaseUrl: connectionString }), {
      database: "connected",
      migrations: "current",
      bootstrapRequired: false,
    });
  });
});

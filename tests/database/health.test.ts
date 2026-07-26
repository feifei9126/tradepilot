import assert from "node:assert/strict";
import test from "node:test";

import { GET as getHealthResponse } from "../../src/app/api/health/route";
import { getDatabaseHealth } from "../../src/lib/database-health";
import { bootstrapAdmin } from "../../scripts/db/bootstrap.mjs";
import { getDatabaseStatus } from "../../scripts/db/status.mjs";
import { withCleanDatabase } from "../helpers/database";

const databaseUrl = process.env.TRADEPILOT_TEST_DATABASE_URL;
const mutableEnvironment = process.env as unknown as Record<
  string,
  string | undefined
>;

if (!databaseUrl) {
  throw new Error("TRADEPILOT_TEST_DATABASE_URL is required for health tests");
}

test("database status reports migration and bootstrap state", async () => {
  await withCleanDatabase(databaseUrl, async ({ databaseUrl, migrate, sql }) => {
    const connectionString = databaseUrl;

    assert.deepEqual(await getDatabaseStatus({ databaseUrl: connectionString }), {
      database: "connected",
      migrations: "outdated",
      bootstrapRequired: true,
    });
    assert.deepEqual(
      await getDatabaseHealth({
        nodeEnv: "production",
        databaseUrl: connectionString,
        sql,
      }),
      {
        status: "error",
        storage: "postgresql",
        database: "connected",
        migrations: "outdated",
        bootstrapRequired: true,
      },
    );

    await migrate();
    assert.deepEqual(await getDatabaseStatus({ databaseUrl: connectionString }), {
      database: "connected",
      migrations: "current",
      bootstrapRequired: true,
    });
    assert.equal(
      (
        await getDatabaseHealth({
          nodeEnv: "production",
          databaseUrl: connectionString,
          sql,
        })
      ).bootstrapRequired,
      true,
    );

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
    assert.deepEqual(
      await getDatabaseHealth({
        nodeEnv: "production",
        databaseUrl: connectionString,
        sql,
      }),
      {
        status: "ok",
        storage: "postgresql",
        database: "connected",
        migrations: "current",
        bootstrapRequired: false,
      },
    );
  });
});

test("health endpoint reports production database configuration errors", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  mutableEnvironment.NODE_ENV = "production";
  delete process.env.DATABASE_URL;
  try {
    const response = await getHealthResponse();
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(response.status, 503);
    assert.equal(body.code, "DATABASE_NOT_CONFIGURED");
    assert.equal(body.storage, "not_configured");
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnvironment.NODE_ENV;
    else mutableEnvironment.NODE_ENV = previousNodeEnv;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

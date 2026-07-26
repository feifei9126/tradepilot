import assert from "node:assert/strict";
import test from "node:test";

import { closeDb } from "../../src/db";
import { BusinessError } from "../../src/lib/business/errors";
import {
  DEMO_COMPANY_ID,
  DEMO_USER_ID,
} from "../../src/lib/business/runtime";
import { authorizeCredentials } from "../../src/lib/auth-credentials";
import { bootstrapAdmin } from "../../scripts/db/bootstrap.mjs";
import { withCleanDatabase } from "../helpers/database";

const databaseUrl = process.env.TRADEPILOT_TEST_DATABASE_URL;
const mutableEnvironment = process.env as unknown as Record<
  string,
  string | undefined
>;
const databaseTest = databaseUrl ? test : test.skip;

function restoreEnvironment(
  values: Record<string, string | undefined>,
) {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test("development memory mode only accepts the fixed demo account", async () => {
  const user = await authorizeCredentials("DEMO@tradepilot.dev", "12345678", {
    nodeEnv: "development",
    databaseUrl: "",
  });
  assert.equal(user?.id, DEMO_USER_ID);
  assert.equal(user?.companyId, DEMO_COMPANY_ID);
  assert.equal(
    await authorizeCredentials("demo@tradepilot.dev", "wrong-password", {
      nodeEnv: "development",
      databaseUrl: "",
    }),
    null,
  );
});

databaseTest("production requires database users and ignores plaintext admin shortcuts", async () => {
  await withCleanDatabase(databaseUrl!, async ({ databaseUrl, migrate }) => {
    await migrate();
    const password = "database-password-123";
    const admin = await bootstrapAdmin({
      databaseUrl,
      email: "owner@example.com",
      password,
      log: () => undefined,
    });
    const previous = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      TRADEPILOT_ADMIN_EMAIL: process.env.TRADEPILOT_ADMIN_EMAIL,
      TRADEPILOT_ADMIN_PASSWORD: process.env.TRADEPILOT_ADMIN_PASSWORD,
    };
    await closeDb();
    mutableEnvironment.NODE_ENV = "production";
    process.env.DATABASE_URL = databaseUrl;
    process.env.TRADEPILOT_ADMIN_EMAIL = "shortcut@example.com";
    process.env.TRADEPILOT_ADMIN_PASSWORD = "plaintext-shortcut";
    try {
      assert.equal(
        await authorizeCredentials("shortcut@example.com", "plaintext-shortcut"),
        null,
      );
      const user = await authorizeCredentials("OWNER@example.com", password);
      assert.equal(user?.id, admin.userId);
      assert.equal(user?.companyId, admin.companyId);
      assert.match(user?.id || "", /^[0-9a-f-]{36}$/i);
    } finally {
      await closeDb();
      restoreEnvironment(previous);
    }
  });
});

test("production without a database reports configuration failure", async () => {
  await assert.rejects(
    () =>
      authorizeCredentials("owner@example.com", "password", {
        nodeEnv: "production",
        databaseUrl: "",
      }),
    (error: unknown) =>
      error instanceof BusinessError &&
      error.code === "DATABASE_NOT_CONFIGURED",
  );
});

test("database connection failures are not reported as invalid credentials", async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
  };
  await closeDb();
  mutableEnvironment.NODE_ENV = "production";
  process.env.DATABASE_URL =
    "postgresql://postgres:tradepilot@127.0.0.1:1/unavailable?connect_timeout=1";
  try {
    await assert.rejects(
      () => authorizeCredentials("owner@example.com", "password"),
      (error: unknown) =>
        error instanceof BusinessError && error.code === "DATABASE_UNAVAILABLE",
    );
  } finally {
    await closeDb();
    restoreEnvironment(previous);
  }
});

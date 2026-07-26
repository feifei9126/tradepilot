import assert from "node:assert/strict";
import test from "node:test";

import { BusinessError } from "../../src/lib/business/errors";
import {
  DEMO_COMPANY_ID,
  DEMO_USER_ID,
  resolveStorageMode,
} from "../../src/lib/business/runtime";

test("development without DATABASE_URL uses the memory demo repository", () => {
  assert.equal(
    resolveStorageMode({ nodeEnv: "development", databaseUrl: "" }),
    "memory",
  );
  assert.match(DEMO_USER_ID, /^[0-9a-f-]{36}$/i);
  assert.match(DEMO_COMPANY_ID, /^[0-9a-f-]{36}$/i);
});

test("a configured database selects PostgreSQL in every environment", () => {
  assert.equal(
    resolveStorageMode({
      nodeEnv: "development",
      databaseUrl: "postgresql://db.example/tradepilot",
    }),
    "postgresql",
  );
  assert.equal(
    resolveStorageMode({
      nodeEnv: "production",
      databaseUrl: " postgresql://db.example/tradepilot ",
    }),
    "postgresql",
  );
});

test("production without DATABASE_URL never falls back to memory", () => {
  assert.throws(
    () => resolveStorageMode({ nodeEnv: "production", databaseUrl: undefined }),
    (error: unknown) =>
      error instanceof BusinessError &&
      error.code === "DATABASE_NOT_CONFIGURED" &&
      error.status === 503,
  );
});

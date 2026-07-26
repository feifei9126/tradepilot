import assert from "node:assert/strict";
import test from "node:test";

import { BusinessError } from "../../src/lib/business/errors";
import {
  injectBusinessContextHeaders,
  requireBusinessContext,
} from "../../src/lib/business/context";
import {
  DEMO_COMPANY_ID,
  DEMO_USER_ID,
} from "../../src/lib/business/runtime";

const trustedContext = {
  userId: DEMO_USER_ID,
  companyId: DEMO_COMPANY_ID,
  role: "owner",
};

test("trusted context headers overwrite client-supplied tenant headers", () => {
  const clientHeaders = new Headers({
    "x-tradepilot-user-id": "11111111-1111-4111-8111-111111111111",
    "x-tradepilot-company-id": "22222222-2222-4222-8222-222222222222",
    "x-tradepilot-role": "owner",
  });

  const trustedHeaders = injectBusinessContextHeaders(
    clientHeaders,
    trustedContext,
  );

  assert.deepEqual(requireBusinessContext({ headers: trustedHeaders }), trustedContext);
});

test("missing trusted headers are unauthorized", () => {
  assert.throws(
    () => requireBusinessContext({ headers: new Headers() }),
    (error: unknown) =>
      error instanceof BusinessError && error.code === "UNAUTHORIZED",
  );
});

test("malformed tenant identifiers are rejected", () => {
  const headers = new Headers({
    "x-tradepilot-user-id": DEMO_USER_ID,
    "x-tradepilot-company-id": "deployment-workspace",
    "x-tradepilot-role": "owner",
  });

  assert.throws(
    () => requireBusinessContext({ headers }),
    (error: unknown) =>
      error instanceof BusinessError && error.code === "TENANT_CONTEXT_INVALID",
  );
});

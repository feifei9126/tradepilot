import assert from "node:assert/strict";
import test from "node:test";

import { canPerformOrganizationAction } from "../../src/lib/organizations/permissions";

test("viewer cannot mutate business data while member can", () => {
  assert.equal(
    canPerformOrganizationAction("viewer", "business:write"),
    false,
  );
  assert.equal(
    canPerformOrganizationAction("member", "business:write"),
    true,
  );
});

test("only an owner can manage another owner", () => {
  assert.equal(
    canPerformOrganizationAction("admin", "members:manage-owner"),
    false,
  );
  assert.equal(
    canPerformOrganizationAction("owner", "members:manage-owner"),
    true,
  );
});

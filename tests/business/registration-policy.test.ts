import assert from "node:assert/strict";
import { test } from "node:test";
import { isRegistrationPasswordAllowed, selfRegistrationEnabled } from "../../src/lib/registration-policy";

test("public workspace registration stays closed unless explicitly enabled", () => {
  assert.equal(selfRegistrationEnabled({}), false);
  assert.equal(selfRegistrationEnabled({ TRADEPILOT_SELF_REGISTRATION: "false" }), false);
  assert.equal(selfRegistrationEnabled({ TRADEPILOT_SELF_REGISTRATION: "TRUE" }), false);
  assert.equal(selfRegistrationEnabled({ TRADEPILOT_SELF_REGISTRATION: "true" }), true);
});

test("registration passwords require 12 characters, variety and character classes", () => {
  assert.equal(isRegistrationPasswordAllowed("short1!"), false);
  assert.equal(isRegistrationPasswordAllowed("abcdefghijkl"), false);
  assert.equal(isRegistrationPasswordAllowed("abcdefghijkl1"), true);
  assert.equal(isRegistrationPasswordAllowed("Abcdefghijk1"), true);
  assert.equal(isRegistrationPasswordAllowed("a".repeat(12) + "1"), false);
  assert.equal(isRegistrationPasswordAllowed("aA1!" + "b".repeat(125)), false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { isValidPluginName } from "../../src/lib/plugin-name";

test("plugin names accept only safe lowercase directory names", () => {
  assert.equal(isValidPluginName("browser-audit-plugin"), true);
  assert.equal(isValidPluginName("plugin2"), true);
  assert.equal(isValidPluginName("Bad Name"), false);
  assert.equal(isValidPluginName("../escape"), false);
  assert.equal(isValidPluginName("-leading"), false);
  assert.equal(isValidPluginName("trailing-"), false);
});

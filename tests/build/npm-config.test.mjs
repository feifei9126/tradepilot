import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("automatic build installs use the same peer-resolution policy as the lockfile", async () => {
  const config = await readFile(new URL("../../.npmrc", import.meta.url), "utf8");
  assert.match(config, /^legacy-peer-deps=true$/m);
  assert.doesNotMatch(config, /^\s*(?:audit=false|force=true|ignore-scripts=true)\s*$/m);
});

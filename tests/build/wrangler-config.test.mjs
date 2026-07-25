import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Wrangler deployments preserve dashboard runtime variables", async () => {
  const configUrl = new URL("../../wrangler.jsonc", import.meta.url);
  const config = await readFile(configUrl, "utf8");

  assert.match(config, /"keep_vars"\s*:\s*true/);
});

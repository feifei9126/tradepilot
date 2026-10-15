import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Wrangler deployments preserve dashboard runtime variables", async () => {
  const configUrl = new URL("../../wrangler.jsonc", import.meta.url);
  const config = await readFile(configUrl, "utf8");

  assert.match(config, /"keep_vars"\s*:\s*true/);
});

test("CI compiles and packages the Cloudflare worker without publishing it", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(workflow, /run: npm run cfbuild/);
  assert.match(workflow, /run: npx wrangler deploy --dry-run/);
  assert.match(workflow, /npm audit --audit-level=high/);
});

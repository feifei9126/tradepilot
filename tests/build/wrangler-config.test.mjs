import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("Wrangler deployments preserve dashboard runtime variables", async () => {
  const configUrl = new URL("../../wrangler.jsonc", import.meta.url);
  const config = await readFile(configUrl, "utf8");

  assert.match(config, /"keep_vars"\s*:\s*true/);
  assert.doesNotMatch(config, /DATABASE_URL\s*:/);
  assert.doesNotMatch(config, /TRADEPILOT_ADMIN_PASSWORD\s*:/);
});

test("Cloudflare auth middleware uses the Edge runtime without database imports", async () => {
  const proxyUrl = new URL("../../src/proxy.ts", import.meta.url);
  const middlewareUrl = new URL("../../src/middleware.ts", import.meta.url);
  const edgeAuthConfigUrl = new URL("../../src/lib/auth-config.ts", import.meta.url);

  await assert.rejects(access(proxyUrl));
  const [middleware, edgeAuthConfig] = await Promise.all([
    readFile(middlewareUrl, "utf8"),
    readFile(edgeAuthConfigUrl, "utf8"),
  ]);
  assert.match(middleware, /NextAuth\(authConfig\)/);
  assert.doesNotMatch(middleware, /from\s+["']@\/lib\/auth["']/);
  assert.doesNotMatch(edgeAuthConfig, /auth-credentials|postgres|node:crypto/);
});

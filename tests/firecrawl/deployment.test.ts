import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getFirecrawlConfig,
  normalizeFirecrawlBaseUrl,
} from "../../src/lib/firecrawl/config";
import {
  canDeployFirecrawlFromBrowser,
  isFirecrawlDeploymentActive,
  isLocalAuthUrl,
} from "../../src/lib/firecrawl/deployment";

test("normalizes Firecrawl URLs and rejects embedded credentials", () => {
  assert.equal(
    normalizeFirecrawlBaseUrl("http://localhost:3002/"),
    "http://localhost:3002",
  );
  assert.throws(
    () => normalizeFirecrawlBaseUrl("http://user:secret@localhost:3002"),
    /不含凭据/,
  );
  assert.throws(() => normalizeFirecrawlBaseUrl("file:///tmp/firecrawl"));
});

test("explicit Firecrawl configuration takes precedence over managed config", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tradepilot-firecrawl-"));
  const managedPath = join(directory, "managed.json");
  await writeFile(
    managedPath,
    JSON.stringify({
      managed: true,
      url: "http://127.0.0.1:3002",
      version: "v2.11.0",
      installedAt: "2026-07-24T00:00:00.000Z",
    }),
  );

  const managed = getFirecrawlConfig({}, managedPath);
  assert.equal(managed.configured, true);
  assert.equal(managed.managed, true);
  assert.equal(managed.url, "http://127.0.0.1:3002");

  const explicit = getFirecrawlConfig(
    { FIRECRAWL_API_URL: "https://api.firecrawl.dev" },
    managedPath,
  );
  assert.equal(explicit.configured, true);
  assert.equal(explicit.managed, false);
  assert.equal(explicit.url, "https://api.firecrawl.dev");
});

test("browser deployment is local-only unless explicitly enabled", () => {
  assert.equal(isLocalAuthUrl("http://localhost:3458"), true);
  assert.equal(isLocalAuthUrl("http://127.20.30.40:3458"), true);
  assert.equal(isLocalAuthUrl("http://[::1]:3458"), true);
  assert.equal(isLocalAuthUrl("https://tradepilot.example.com"), false);

  assert.equal(
    canDeployFirecrawlFromBrowser(
      { AUTH_URL: "http://localhost:3458" },
      "http://localhost:3458/api/firecrawl/deploy",
    ),
    true,
  );
  assert.equal(
    canDeployFirecrawlFromBrowser(
      { AUTH_URL: "http://localhost:3458" },
      "https://tradepilot.example.com/api/firecrawl/deploy",
    ),
    false,
  );
  assert.equal(
    canDeployFirecrawlFromBrowser(
      { TRADEPILOT_ALLOW_SERVICE_DEPLOY: "true" },
      "https://tradepilot.example.com/api/firecrawl/deploy",
    ),
    true,
  );
});

test("deployment activity only includes unfinished phases", () => {
  const status = {
    phase: "building" as const,
    progress: 35,
    message: "构建中",
    version: "v2.11.0",
  };
  assert.equal(isFirecrawlDeploymentActive(status), true);
  assert.equal(
    isFirecrawlDeploymentActive({ ...status, phase: "ready" }),
    false,
  );
  assert.equal(
    isFirecrawlDeploymentActive({ ...status, phase: "failed" }),
    false,
  );
});

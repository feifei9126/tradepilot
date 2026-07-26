import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCloudflareSetup } from "../../scripts/setup-cloudflare.mjs";

const databaseUrl = "postgresql://deploy-user:deploy-password@neon.example/tradepilot?sslmode=require";
const adminPassword = "admin-password-that-must-not-leak";
const authSecret = "auth-secret-that-must-not-leak";
const credentialsKey = Buffer.alloc(32, 11).toString("base64url");

function setupInput(overrides = {}) {
  return {
    DATABASE_URL: databaseUrl,
    TRADEPILOT_ADMIN_EMAIL: "admin@example.com",
    TRADEPILOT_ADMIN_PASSWORD: adminPassword,
    AUTH_SECRET: authSecret,
    TRADEPILOT_CREDENTIALS_KEY: credentialsKey,
    TRADEPILOT_HEALTH_URL: "https://tradepilot.example.workers.dev",
    ...overrides,
  };
}

test("Cloudflare setup dry-run lists safe ordered steps without executing commands", async () => {
  const logs = [];
  const calls = [];

  await runCloudflareSetup({
    env: setupInput(),
    dryRun: true,
    exec: async (...args) => calls.push(args),
    fetch: async () => {
      throw new Error("dry-run must not fetch health");
    },
    log: (message) => logs.push(String(message)),
  });

  assert.equal(calls.length, 0);
  const output = logs.join("\n");
  assert.deepEqual(
    ["status", "migrate", "bootstrap", "secret DATABASE_URL", "secret AUTH_SECRET", "secret TRADEPILOT_CREDENTIALS_KEY", "secret TRADEPILOT_CRON_SECRET", "build", "deploy", "health"].map(
      (step) => output.indexOf(step),
    ).every((index) => index >= 0),
    true,
  );
  assert.ok(output.indexOf("status") < output.indexOf("migrate"));
  assert.ok(output.indexOf("migrate") < output.indexOf("bootstrap"));
  assert.ok(output.indexOf("bootstrap") < output.indexOf("secret DATABASE_URL"));
  assert.ok(output.indexOf("secret AUTH_SECRET") < output.indexOf("build"));
  assert.ok(output.indexOf("secret TRADEPILOT_CREDENTIALS_KEY") < output.indexOf("build"));
  assert.ok(output.indexOf("secret TRADEPILOT_CRON_SECRET") < output.indexOf("build"));
  assert.ok(output.indexOf("build") < output.indexOf("deploy"));
  assert.ok(output.indexOf("deploy") < output.indexOf("health"));
  assert.equal(output.includes(databaseUrl), false);
  assert.equal(output.includes(adminPassword), false);
  assert.equal(output.includes(authSecret), false);
  assert.equal(output.includes(credentialsKey), false);
});

test("Cloudflare setup keeps credentials out of argv and verifies health", async () => {
  const calls = [];
  const logs = [];
  const healthRequests = [];
  const exec = async (command, args, options = {}) => {
    calls.push({ command, args, options });
    const hostileOutput = args.includes("db:status")
      ? `url=${databaseUrl} password=${adminPassword} auth=${authSecret}`
      : "";
    return { status: 0, stdout: hostileOutput, stderr: "" };
  };
  const fetch = async (url) => {
    healthRequests.push(url);
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  const result = await runCloudflareSetup({
    env: setupInput(),
    exec,
    fetch,
    log: (message) => logs.push(String(message)),
  });

  assert.deepEqual(
    calls.map(({ command, args }) => [command, ...args].join(" ")),
    [
      "npm run db:status",
      "npm run db:migrate",
      "npm run db:bootstrap",
      "npx wrangler secret put DATABASE_URL",
      "npx wrangler secret put AUTH_SECRET",
      "npx wrangler secret put TRADEPILOT_CREDENTIALS_KEY",
      "npx wrangler secret put TRADEPILOT_CRON_SECRET",
      "npm run cfbuild",
      "npx wrangler deploy",
    ],
  );
  const argv = calls.map(({ args }) => args.join(" ")).join("\n");
  assert.equal(argv.includes(databaseUrl), false);
  assert.equal(argv.includes(adminPassword), false);
  assert.equal(argv.includes(authSecret), false);
  assert.equal(argv.includes(credentialsKey), false);
  assert.equal(calls[3].options.input, `${databaseUrl}\n`);
  assert.equal(calls[4].options.input, `${authSecret}\n`);
  assert.equal(calls[5].options.input, `${credentialsKey}\n`);
  assert.match(calls[6].options.input, /^[A-Za-z0-9_-]{43}\n$/);
  assert.equal(calls[2].options.env.TRADEPILOT_ADMIN_PASSWORD, adminPassword);
  assert.equal(calls[2].options.env.DATABASE_URL, databaseUrl);
  const output = logs.join("\n");
  assert.equal(output.includes(databaseUrl), false);
  assert.equal(output.includes(adminPassword), false);
  assert.equal(output.includes(authSecret), false);
  assert.equal(output.includes(credentialsKey), false);
  assert.deepEqual(healthRequests, ["https://tradepilot.example.workers.dev/api/health"]);
  assert.equal(result.health.ok, true);
});

test("Cloudflare setup rejects non-interactive configuration without a database URL", async () => {
  await assert.rejects(
    runCloudflareSetup({
      env: { TRADEPILOT_ADMIN_EMAIL: "admin@example.com", TRADEPILOT_ADMIN_PASSWORD: adminPassword },
      nonInteractive: true,
    }),
    /DATABASE_URL is required/,
  );
});

test("Cloudflare setup persists generated runtime secrets across repeated deployments", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "tradepilot-cloudflare-"));
  const env = setupInput({ AUTH_SECRET: "", TRADEPILOT_CREDENTIALS_KEY: "", TRADEPILOT_CRON_SECRET: "" });
  const runs = [];
  try {
    for (let run = 0; run < 2; run += 1) {
      const calls = [];
      await runCloudflareSetup({
        cwd,
        env,
        exec: async (command, args, options = {}) => {
          calls.push({ command, args, options });
          return { status: 0, stdout: "", stderr: "" };
        },
        fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
        log: () => {},
      });
      runs.push(Object.fromEntries(calls
        .filter((call) => call.args.includes("put"))
        .map((call) => [call.args.at(-1), call.options.input])));
    }

    assert.equal(runs[0].AUTH_SECRET, runs[1].AUTH_SECRET);
    assert.equal(runs[0].TRADEPILOT_CREDENTIALS_KEY, runs[1].TRADEPILOT_CREDENTIALS_KEY);
    assert.equal(runs[0].TRADEPILOT_CRON_SECRET, runs[1].TRADEPILOT_CRON_SECRET);
    const state = await readFile(join(cwd, ".env.cloudflare"), "utf8");
    assert.match(state, /^AUTH_SECRET=/m);
    assert.match(state, /^TRADEPILOT_CREDENTIALS_KEY=/m);
    assert.match(state, /^TRADEPILOT_CRON_SECRET=/m);
    assert.equal(state.includes(databaseUrl), false);
    assert.equal(state.includes(adminPassword), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

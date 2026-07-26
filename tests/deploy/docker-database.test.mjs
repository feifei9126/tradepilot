import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { parse } from "yaml";

const root = process.cwd();

function parseEnvironment(value) {
  if (!value) return {};
  if (!Array.isArray(value)) return value;
  return Object.fromEntries(
    value.map((entry) => {
      const separator = entry.indexOf("=");
      return separator < 0
        ? [entry, ""]
        : [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
}

function parseEnvFile(value) {
  return Object.fromEntries(
    value
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

test("Docker Compose starts PostgreSQL, initializes it, then starts TradePilot", async () => {
  const compose = parse(
    await readFile(path.join(root, "docker-compose.yml"), "utf8"),
  );
  const { postgres, "db-init": dbInit, tradepilot } = compose.services;
  assert.ok(postgres);
  assert.match(postgres.image, /postgres:17-alpine$/);
  assert.ok(postgres.healthcheck?.test);
  assert.equal(
    postgres.volumes.includes("tradepilot_postgres:/var/lib/postgresql/data"),
    true,
  );

  assert.ok(dbInit);
  assert.deepEqual(dbInit.command, ["npm", "run", "db:init"]);
  assert.equal(dbInit.depends_on.postgres.condition, "service_healthy");
  assert.match(
    parseEnvironment(dbInit.environment).DATABASE_URL,
    /@postgres:5432\/tradepilot$/,
  );

  assert.equal(
    tradepilot.depends_on["db-init"].condition,
    "service_completed_successfully",
  );
  assert.match(
    parseEnvironment(tradepilot.environment).DATABASE_URL,
    /@postgres:5432\/tradepilot$/,
  );
  assert.ok(tradepilot.healthcheck?.test);
  assert.ok(compose.volumes.tradepilot_postgres !== undefined);
});

test("Docker image contains migration and bootstrap scripts", async () => {
  const dockerfile = await readFile(path.join(root, "Dockerfile"), "utf8");
  assert.match(dockerfile, /COPY --from=builder .*\/scripts \.\/scripts/);
  assert.match(
    dockerfile,
    /COPY --from=builder .*\/src\/db\/migrations \.\/src\/db\/migrations/,
  );
});

test("shell installer bootstraps PostgreSQL without rotating existing secrets", async (t) => {
  const gitBash = "C:/Program Files/Git/bin/bash.exe";
  const bashCommand =
    process.platform === "win32" ? gitBash : "bash";
  const bashVersion = spawnSync(bashCommand, ["--version"], {
    encoding: "utf8",
  });
  if (bashVersion.error || bashVersion.status !== 0) {
    t.skip("bash is unavailable");
    return;
  }

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "tradepilot-install-"),
  );
  const envFile = path.join(temporaryDirectory, ".env").replaceAll("\\", "/");
  const stateDirectory = path
    .join(temporaryDirectory, "state")
    .replaceAll("\\", "/");
  const run = () =>
    spawnSync(bashCommand, [path.join(root, "install.sh")], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        TRADEPILOT_ENV_FILE: envFile,
        TRADEPILOT_HOME: stateDirectory,
        TRADEPILOT_INSTALL_TEST_MODE: "true",
        TRADEPILOT_NON_INTERACTIVE: "true",
      },
    });

  try {
    const first = run();
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const firstContents = await readFile(envFile, "utf8");
    const firstEnvironment = parseEnvFile(firstContents);
    assert.match(firstEnvironment.AUTH_SECRET, /^[a-f0-9]{64}$/);
    assert.match(firstEnvironment.POSTGRES_PASSWORD, /^[a-f0-9]{32,}$/);
    assert.match(firstEnvironment.TRADEPILOT_ADMIN_PASSWORD, /^[a-f0-9]{24,}$/);
    assert.equal(firstEnvironment.TRADEPILOT_ADMIN_EMAIL, "admin@tradepilot.local");
    assert.match(first.stdout, /docker compose up -d postgres/);
    assert.match(first.stdout, /docker compose run --rm db-init/);
    assert.match(
      first.stdout,
      /docker compose up -d --build tradepilot video-worker/,
    );

    const second = run();
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(await readFile(envFile, "utf8"), firstContents);

  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("Windows installer generates secrets and preserves them on rerun", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows command processor is unavailable");
    return;
  }

  const batch = await readFile(path.join(root, "install.bat"), "utf8");
  assert.doesNotMatch(batch, /ToHexString/);
  assert.match(batch, /RandomNumberGenerator\]::Create\(\)/);
  assert.match(batch, /docker compose(?: --env-file [^\r\n]+)? run --rm db-init/);

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "tradepilot-install-bat-"),
  );
  const envFile = path.join(temporaryDirectory, ".env");
  const run = () =>
    spawnSync("cmd.exe", ["/d", "/s", "/c", "install.bat"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        TRADEPILOT_ENV_FILE: envFile,
        TRADEPILOT_INSTALL_TEST_MODE: "true",
        TRADEPILOT_NON_INTERACTIVE: "true",
      },
    });

  try {
    const first = run();
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const firstContents = await readFile(envFile, "utf8");
    const firstEnvironment = parseEnvFile(firstContents);
    assert.match(firstEnvironment.AUTH_SECRET, /^[a-f0-9]{64}$/);
    assert.match(firstEnvironment.POSTGRES_PASSWORD, /^[a-f0-9]{32,}$/);
    assert.match(firstEnvironment.TRADEPILOT_ADMIN_PASSWORD, /^[a-f0-9]{24,}$/);
    assert.match(first.stdout, /docker compose up -d postgres/);
    assert.match(first.stdout, /docker compose run --rm db-init/);

    const second = run();
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(await readFile(envFile, "utf8"), firstContents);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

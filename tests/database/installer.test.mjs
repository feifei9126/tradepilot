import assert from "node:assert/strict";
import { test } from "node:test";
import { copyFile, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function fixture(envText, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "tradepilot-installer-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await copyFile(new URL("../../install.sh", import.meta.url), join(root, "install.sh"));
  if (envText !== undefined) await writeFile(join(root, ".env"), envText);
  // These stubs cannot contact Docker or a real service. Only configuration
  // arguments are logged; database passwords and auth secrets are not logged.
  await writeFile(join(bin, "docker"), [
    "#!/bin/sh",
    'if [ "$*" = "compose up -d moneyprinterturbo" ]; then',
    "  sleep 0.1",
    '  printf "background-complete\\n" >> "$STUB_LOG"',
    "fi",
    'printf "%s|%s|%s\\n" "$PORT" "$AUTH_URL" "$*" >> "$STUB_LOG"',
    "exit 0",
    "",
  ].join("\n"), { mode: 0o700 });
  await writeFile(join(bin, "curl"), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  const env = { ...process.env, HOME: root, TRADEPILOT_HOME: join(root, "state"), PATH: `${bin}:${process.env.PATH}`, STUB_LOG: join(root, "docker.log") };
  delete env.PORT;
  delete env.AUTH_URL;
  Object.assign(env, overrides);
  // Source the copied installer in a test-only shell so wait joins its background
  // Docker stub before the fixture is inspected or its temporary files removed.
  const result = spawnSync("bash", ["-c", 'source "$1"; wait', "installer-test", join(root, "install.sh")], {
    env, cwd: root, encoding: "utf8", timeout: 15_000,
  });
  return { root, result, cleanup: () => rm(root, { force: true, recursive: true }) };
}

const existing = [
  "PORT=4242", "AUTH_URL=https://tradepilot.example", "AUTH_SECRET=existing-auth-secret",
  "TRADEPILOT_ADMIN_EMAIL=admin@example.com", "TRADEPILOT_ADMIN_PASSWORD=existing-password",
  "POSTGRES_PASSWORD=existing-db-password", "",
].join("\n");

test("installer first run generates private credentials and uses 3461 without an existing .env", async () => {
  const f = await fixture();
  try {
    assert.equal(f.result.status, 0, f.result.stderr);
    const env = await readFile(join(f.root, ".env"), "utf8");
    assert.match(env, /^AUTH_SECRET=[a-f0-9]{64}$/m);
    assert.match(env, /^POSTGRES_PASSWORD=[a-f0-9]{64}$/m);
    assert.match(env, /^TRADEPILOT_ADMIN_PASSWORD=[a-f0-9]{24}$/m);
    assert.equal((await stat(join(f.root, ".env"))).mode & 0o077, 0);
    assert.match(await readFile(join(f.root, "docker.log"), "utf8"), /3461\|http:\/\/localhost:3461\|compose config/);
  } finally { await f.cleanup(); }
});

test("installer rerun keeps existing secrets, port and AUTH_URL", async () => {
  const f = await fixture(existing);
  try {
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.equal(await readFile(join(f.root, ".env"), "utf8"), existing);
    assert.match(await readFile(join(f.root, "docker.log"), "utf8"), /4242\|https:\/\/tradepilot.example\|compose up -d --build tradepilot video-worker/);
  } finally { await f.cleanup(); }
});

test("installer fixture waits for the background video process before cleanup", async () => {
  const f = await fixture(existing);
  try {
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.match(await readFile(join(f.root, "docker.log"), "utf8"), /background-complete/);
  } finally { await f.cleanup(); }
});

test("installer explicit PORT override does not overwrite existing .env settings", async () => {
  const f = await fixture(existing, { PORT: "4343" });
  try {
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.equal(await readFile(join(f.root, ".env"), "utf8"), existing);
    assert.match(await readFile(join(f.root, "docker.log"), "utf8"), /4343\|https:\/\/tradepilot.example\|compose config/);
  } finally { await f.cleanup(); }
});

test("installer refuses an invalid port before changing .env", async () => {
  for (const port of ["0", "65536", "not-a-port"]) {
    const f = await fixture(existing, { PORT: port });
    try {
      assert.notEqual(f.result.status, 0);
      assert.match(f.result.stderr, /PORT/);
      assert.equal(await readFile(join(f.root, ".env"), "utf8"), existing);
    } finally { await f.cleanup(); }
  }
});

test("installer refuses a copied public demo password before changing existing .env", async () => {
  for (const password of ["12345678","qwerty123456789012","short-secret"]) {
    const text = existing.replace("existing-password",password);
    const f = await fixture(text);
    try { assert.notEqual(f.result.status,0); assert.match(f.result.stderr,/密码/); assert.equal(await readFile(join(f.root,".env"),"utf8"),text); }
    finally { await f.cleanup(); }
  }
});

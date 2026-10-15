import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredLinuxPackages = [
  "node_modules/@ffmpeg-installer/linux-x64",
  "node_modules/@tailwindcss/oxide-linux-x64-gnu",
  "node_modules/@unrs/resolver-binding-linux-x64-gnu",
  "node_modules/lightningcss-linux-x64-gnu",
];

const requiredOxideWasmPackages = [
  "node_modules/@tailwindcss/oxide-wasm32-wasi",
  "node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/@emnapi/core",
  "node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/@emnapi/runtime",
  "node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/@emnapi/wasi-threads",
  "node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/@napi-rs/wasm-runtime",
  "node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/@tybys/wasm-util",
  "node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/tslib",
];

const officialNpmRegistry = "https://registry.npmjs.org/";

async function readLockPackages() {
  const lockFile = new URL("../../package-lock.json", import.meta.url);
  const lock = JSON.parse(await readFile(lockFile, "utf8"));
  return lock.packages ?? {};
}

test("package lock includes native dependencies for Cloudflare Linux builds", async () => {
  const packages = await readLockPackages();
  const missingPackages = requiredLinuxPackages.filter(
    (packagePath) => !packages[packagePath],
  );

  assert.deepEqual(missingPackages, []);
});

test("Cloudflare native dependencies resolve from the official npm registry", async () => {
  const packages = await readLockPackages();
  const nonOfficialPackages = requiredLinuxPackages.filter((packagePath) => {
    const resolved = packages[packagePath]?.resolved;
    return (
      typeof resolved !== "string" || !resolved.startsWith(officialNpmRegistry)
    );
  });

  assert.deepEqual(nonOfficialPackages, []);
});

test("registry packages use official npm; only the audited braces fork may be a local link", async () => {
  const packages = await readLockPackages();
  const nonOfficialPackages = Object.entries(packages)
    .filter(([, entry]) => typeof entry.resolved === "string")
    .filter(([packagePath, entry]) => !(
      packagePath === "node_modules/braces" && entry.link === true && entry.resolved === "vendor/braces"
    ))
    .filter(([, entry]) => !entry.resolved.startsWith(officialNpmRegistry))
    .map(([packagePath]) => packagePath);

  assert.deepEqual(nonOfficialPackages, []);
});

test("package lock includes the Tailwind Oxide WASM dependency closure", async () => {
  const packages = await readLockPackages();
  const missingPackages = requiredOxideWasmPackages.filter(
    (packagePath) => !packages[packagePath],
  );

  assert.deepEqual(missingPackages, []);
});

test("the local braces override is dev-only and cannot leave an unpatched nested copy", async () => {
  const packages = await readLockPackages();
  assert.deepEqual(packages["node_modules/braces"], { resolved: "vendor/braces", link: true });
  assert.equal(packages["vendor/braces"].name, "@tradepilot/braces");
  assert.equal(packages["vendor/braces"].dev, true);
  assert.deepEqual(Object.keys(packages).filter(path => path.endsWith("/node_modules/braces") && path !== "node_modules/braces"), []);
});

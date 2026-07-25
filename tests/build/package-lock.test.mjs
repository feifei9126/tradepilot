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

test("package lock includes the Tailwind Oxide WASM dependency closure", async () => {
  const packages = await readLockPackages();
  const missingPackages = requiredOxideWasmPackages.filter(
    (packagePath) => !packages[packagePath],
  );

  assert.deepEqual(missingPackages, []);
});

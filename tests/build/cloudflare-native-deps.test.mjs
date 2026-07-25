import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helperUrl = new URL(
  "../../scripts/ensure-cloudflare-native-deps.mjs",
  import.meta.url,
);

test("Cloudflare prebuild selects exact locked Linux native packages", async () => {
  const { getRequiredNativePackages } = await import(helperUrl);
  const lockPackages = {
    "node_modules/lightningcss-linux-x64-gnu": { version: "1.32.0" },
    "node_modules/@tailwindcss/oxide-linux-x64-gnu": { version: "4.3.0" },
  };

  assert.deepEqual(
    getRequiredNativePackages(lockPackages, {
      platform: "linux",
      arch: "x64",
    }),
    [
      {
        name: "lightningcss-linux-x64-gnu",
        spec: "lightningcss-linux-x64-gnu@1.32.0",
      },
      {
        name: "@tailwindcss/oxide-linux-x64-gnu",
        spec: "@tailwindcss/oxide-linux-x64-gnu@4.3.0",
      },
    ],
  );
});

test("Cloudflare prebuild skips native repair outside Linux x64", async () => {
  const { getRequiredNativePackages } = await import(helperUrl);

  assert.deepEqual(
    getRequiredNativePackages({}, { platform: "win32", arch: "x64" }),
    [],
  );
});

test("cfbuild runs the native dependency preflight", async () => {
  const packageJsonUrl = new URL("../../package.json", import.meta.url);
  const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));

  assert.equal(
    packageJson.scripts.precfbuild,
    "node scripts/ensure-cloudflare-native-deps.mjs",
  );
});

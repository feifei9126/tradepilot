import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const officialNpmRegistry = "https://registry.npmjs.org/";
const linuxX64NativePackages = [
  "lightningcss-linux-x64-gnu",
  "@tailwindcss/oxide-linux-x64-gnu",
];

export function getRequiredNativePackages(
  lockPackages,
  { platform = process.platform, arch = process.arch } = {},
) {
  if (platform !== "linux" || arch !== "x64") return [];

  return linuxX64NativePackages.map((name) => {
    const version = lockPackages[`node_modules/${name}`]?.version;
    if (!version) {
      throw new Error(`package-lock.json is missing ${name}`);
    }
    return { name, spec: `${name}@${version}` };
  });
}

function isInstalled(name) {
  try {
    require.resolve(name);
    return true;
  } catch (error) {
    if (error?.code === "MODULE_NOT_FOUND") return false;
    throw error;
  }
}

function installPackages(packages) {
  const installArgs = [
    "install",
    "--no-save",
    "--package-lock=false",
    "--ignore-scripts",
    "--include=optional",
    `--registry=${officialNpmRegistry}`,
    ...packages.map(({ spec }) => spec),
  ];
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";
  const args = npmExecPath ? [npmExecPath, ...installArgs] : installArgs;
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm failed to install Cloudflare native dependencies`);
  }
}

async function main() {
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
  const requiredPackages = getRequiredNativePackages(lock.packages ?? {});
  const missingPackages = requiredPackages.filter(
    ({ name }) => !isInstalled(name),
  );

  if (missingPackages.length === 0) {
    console.log("Cloudflare native dependencies are available.");
    return;
  }

  console.log(
    `Installing missing Cloudflare native dependencies: ${missingPackages
      .map(({ spec }) => spec)
      .join(", ")}`,
  );
  installPackages(missingPackages);

  const unresolvedPackages = missingPackages.filter(
    ({ name }) => !isInstalled(name),
  );
  if (unresolvedPackages.length > 0) {
    throw new Error(
      `Cloudflare native dependencies remain unavailable: ${unresolvedPackages
        .map(({ name }) => name)
        .join(", ")}`,
    );
  }
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) await main();

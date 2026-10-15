import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

function configure(runtime, phases) {
  // Intercept the real configuration's lazy import. No native Workerd process
  // can run during this regression test, including when the package is absent.
  const stub =
    "globalThis.cloudflareImports++; export async function initOpenNextCloudflareForDev() { globalThis.cloudflareInitializations++; }";
  const loader = [
    "export async function resolve(specifier, context, nextResolve) {",
    '  if (specifier === "@opennextjs/cloudflare") {',
    `    const source = ${JSON.stringify(stub)};`,
    '    return { url: "data:text/javascript," + encodeURIComponent(source), shortCircuit: true };',
    "  }",
    "  return nextResolve(specifier, context);",
    "}",
  ].join("\n");
  const script = `
    import { register } from 'node:module';
    globalThis.cloudflareImports = 0;
    globalThis.cloudflareInitializations = 0;
    const loader = ${JSON.stringify(loader)};
    register('data:text/javascript,' + encodeURIComponent(loader), import.meta.url);
    const module = await import('./next.config.ts');
    const configure = module.default?.default ?? module.default;
    const configs = [];
    for (const phase of ${JSON.stringify(phases)}) configs.push(await configure(phase));
    console.log(JSON.stringify({ configs, imports: globalThis.cloudflareImports, initialized: globalThis.cloudflareInitializations }));
  `;
  const env = { ...process.env, NODE_ENV: "production" };
  if (runtime === undefined) delete env.TRADEPILOT_RUNTIME;
  else env.TRADEPILOT_RUNTIME = runtime;
  return JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        cwd: new URL("../../", import.meta.url),
        env,
        encoding: "utf8",
        timeout: 15_000,
      },
    ),
  );
}

const phases = [
  "phase-development-server",
  "phase-production-build",
  "phase-production-server",
];

test("default Node.js development/build/start do not import Cloudflare or launch Workerd", () => {
  assert.deepEqual(configure(undefined, phases), {
    configs: [{}, {}, {}],
    imports: 0,
    initialized: 0,
  });
});

test("Docker Node.js runtime never imports Cloudflare, including the development phase", () => {
  assert.deepEqual(configure("node", phases), {
    configs: [{}, {}, {}],
    imports: 0,
    initialized: 0,
  });
});

test("Cloudflare development is explicit and production phases never launch its emulator", () => {
  assert.deepEqual(configure("cloudflare", phases.slice(1)), {
    configs: [{}, {}],
    imports: 0,
    initialized: 0,
  });
  assert.deepEqual(configure("cloudflare", [phases[0]]), {
    configs: [{}],
    imports: 1,
    initialized: 1,
  });
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("production config loads without launching the Cloudflare emulator", () => {
  const output = execFileSync(process.execPath, [
    "--import", "tsx", "--input-type=module", "-e",
    `import config from './next.config.ts';
     import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants.js';
     const configure = config.default ?? config;
     for (const phase of [PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER]) {
       const result = await configure(phase);
       if (JSON.stringify(result) !== '{}') throw new Error('Unexpected config');
     }
     console.log('production-config-ok');`,
  ], {
    cwd: new URL("../../", import.meta.url),
    env: { ...process.env, NODE_ENV: "production" },
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(output.trim(), "production-config-ok");
});

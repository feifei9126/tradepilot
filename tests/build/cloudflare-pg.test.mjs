import assert from "node:assert/strict";
import test from "node:test";
import { fixCloudflarePg } from "../../scripts/fix-cloudflare-pg.mjs";

test("Cloudflare middleware socket repair preserves unrelated empty exports and is idempotent", () => {
  const source = `var require_empty = __commonJS({
    ".open-next/middleware/node_modules/pg-cloudflare/dist/empty.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.default = {};
    }
  });
  var other = { default: {} };`;
  const result = fixCloudflarePg(source);
  assert.match(result, /exports.CloudflareSocket = TradePilotCloudflareSocket/);
  assert.match(result, /var other = \{ default: \{\} \}/);
  assert.equal(fixCloudflarePg(result), result);
});

test("Cloudflare middleware socket repair refuses unknown/ambiguous generated code", () => {
  assert.throws(() => fixCloudflarePg("exports.default = {};"), /exactly one/);
});

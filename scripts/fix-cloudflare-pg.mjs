import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// OpenNext 1.20.13's Node middleware bundler only enables the module
// condition. pg-cloudflare therefore resolves to empty.js in the proxy,
// while the server bundle correctly enables workerd. Keep the real socket
// import from the traced server implementation for Wrangler.
export function fixCloudflarePg(source) {
  if (source.includes('import { CloudflareSocket as TradePilotCloudflareSocket } from "../server-functions/default/node_modules/pg-cloudflare/esm/index.mjs";')) return source;
  const pattern = /("[^"\n]*\/pg-cloudflare\/dist\/empty\.js"\(exports\)\s*\{\s*"use strict";\s*Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*)exports\.default = \{\};/g;
  let count = 0;
  const result = source.replace(pattern, (_, prefix) => {
    count++;
    return `${prefix}exports.CloudflareSocket = TradePilotCloudflareSocket;`;
  });
  if (count !== 1) throw new Error("Cloudflare pg socket shim did not find exactly one middleware stub; review the OpenNext bundle before deploying");
  return 'import { CloudflareSocket as TradePilotCloudflareSocket } from "../server-functions/default/node_modules/pg-cloudflare/esm/index.mjs";\n' + result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = new URL("../.open-next/middleware/handler.mjs", import.meta.url);
  await writeFile(file, fixCloudflarePg(await readFile(file, "utf8")));
  console.log("Cloudflare proxy now uses the real pg-cloudflare socket export.");
}

import { existsSync } from "node:fs";
// Node 22's loader respects already-set environment values. No devDependency
// is needed in the production image. Compose injects its env directly.
for (const path of [".env.local", ".env"]) {
  if (existsSync(path)) process.loadEnvFile(path);
}

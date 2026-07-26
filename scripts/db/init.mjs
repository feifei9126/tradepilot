import { bootstrapAdmin } from "./bootstrap.mjs";
import { isMainModule, requireDatabaseUrl, safeErrorMessage } from "./common.mjs";
import { runMigrations } from "./migrate.mjs";
import { seedDemoData } from "./seed.mjs";

export async function runDatabaseInit({ env = process.env, log = console.log } = {}) {
  const databaseUrl = requireDatabaseUrl(env);
  await runMigrations({ databaseUrl, log });
  await bootstrapAdmin({
    databaseUrl,
    email: env.TRADEPILOT_ADMIN_EMAIL,
    password: env.TRADEPILOT_ADMIN_PASSWORD,
    log,
  });
  await seedDemoData({
    databaseUrl,
    enabled: env.TRADEPILOT_SEED_DEMO === "true",
    adminEmail: env.TRADEPILOT_ADMIN_EMAIL,
    log,
  });
  log("TradePilot 数据库初始化完成");
}

if (isMainModule(import.meta.url)) {
  runDatabaseInit().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
}

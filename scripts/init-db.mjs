import "./database/env.mjs";
import { Pool } from "pg";
import { applyMigrations } from "./database/migrations.mjs";
import { bootstrapOwner } from "./database/bootstrap.mjs";
import { postgresPoolConfig } from "./database/config.mjs";

let databaseConfig;
try { databaseConfig = postgresPoolConfig(); } catch (error) {
  console.error(error instanceof Error ? error.message : "PostgreSQL configuration is required");
  process.exit(1);
}
const adminEmail = process.env.TRADEPILOT_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.TRADEPILOT_ADMIN_PASSWORD;
const seedDemo = process.env.TRADEPILOT_SEED_DEMO === "true";
const workspaceSlug = process.env.TRADEPILOT_WORKSPACE_SLUG?.trim() || "tradepilot-admin";
const resetPassword =
  process.argv.includes("--reset-password") ||
  process.env.TRADEPILOT_RESET_ADMIN_PASSWORD === "true";

if ((!adminEmail || !adminPassword) && !seedDemo) {
  console.error(
    "Set TRADEPILOT_ADMIN_EMAIL and TRADEPILOT_ADMIN_PASSWORD, or explicitly enable TRADEPILOT_SEED_DEMO=true",
  );
  process.exit(1);
}

async function main() {
  const pool = new Pool({ ...databaseConfig, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    await applyMigrations(pool);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (adminEmail && adminPassword) {
        const result = await bootstrapOwner(client, {
          companyName: "TradePilot Admin",
          companySlug: workspaceSlug,
          email: adminEmail,
          name: "Admin",
          password: adminPassword,
          resetPassword,
        });
        console.log(
          `${result.created ? "Created" : "Preserved"} admin workspace for ${adminEmail}` +
            (result.passwordReset ? " (password initialized/reset)" : " (existing password preserved)"),
        );
      }

      if (seedDemo) {
        const result = await bootstrapOwner(client, {
          companyName: "TradePilot Demo",
          companySlug: "tradepilot-demo",
          email: "demo@tradepilot.dev",
          name: "Demo User",
          password: "12345678",
          resetPassword,
        });
        console.log(
          `${result.created ? "Created" : "Preserved"} demo account demo@tradepilot.dev` +
            (result.passwordReset ? " (password initialized/reset)" : " (existing password preserved)"),
        );
      }

      await client.query("COMMIT");
      console.log(
        `TradePilot account database initialization complete${resetPassword ? "; explicit password reset was requested" : ""}`,
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  // Error messages are intentionally generic: connection strings may contain credentials.
  console.error("Database initialization failed. Check PostgreSQL settings, connectivity, and database permissions.");
  if (process.env.NODE_ENV !== "production" && error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
});

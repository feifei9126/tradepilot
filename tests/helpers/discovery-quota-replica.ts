/** Separate process used only against a validated loopback *_test database. */
import { configureTestDatabase } from "./test-database";
import { reserveTenantDiscovery } from "../../src/lib/tenant-discovery";
import { ProspectingError } from "../../src/lib/prospecting";
import { closeDbPool } from "../../src/db";

async function main() {
  configureTestDatabase();
  const [companyId, actorId, countValue] = process.argv.slice(2);
  const count = Number(countValue);
  if (![companyId, actorId].every(id => /^[0-9a-f-]{36}$/i.test(id || "")) || !Number.isInteger(count) || count < 1 || count > 10) throw new Error("Invalid discovery replica fixture");
  try {
    const results = await Promise.all(Array.from({ length: count }, async () => {
      try { await reserveTenantDiscovery(companyId, actorId); return { allowed: true, status: 200 }; }
      catch (error) {
        if (!(error instanceof ProspectingError)) throw error;
        return { allowed: false, status: error.status };
      }
    }));
    // Never print the workspace Key returned by a reservation.
    process.stdout.write(JSON.stringify(results));
  } finally { await closeDbPool(); }
}
void main().catch(() => { console.error("Discovery replica fixture failed (details omitted)"); process.exitCode = 1; });

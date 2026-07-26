import test from "node:test";

import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "../../src/db/schema";
import { createPostgresRepository } from "../../src/lib/repositories/postgres";
import { withCleanDatabase } from "../helpers/database";
import {
  contextA,
  contextB,
  runRepositoryContract,
} from "./contract";

const databaseUrl = process.env.TRADEPILOT_TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("TRADEPILOT_TEST_DATABASE_URL is required for repository tests");
}

test("postgres repositories obey the business repository contract", async () => {
  await withCleanDatabase(databaseUrl, async ({ sql, migrate }) => {
    await migrate();
    await sql`
      INSERT INTO companies (id, name, slug)
      VALUES
        (${contextA.companyId}, 'Company A', 'company-a'),
        (${contextB.companyId}, 'Company B', 'company-b')
    `;

    const db = drizzle(sql, { schema });
    await runRepositoryContract(async (context) =>
      createPostgresRepository(db, context),
    );
  });
});

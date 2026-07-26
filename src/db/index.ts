import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { BusinessError } from "@/lib/business/errors";

import * as schema from "./schema";

let databaseClient: Sql | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

function validatedDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error("Unsupported database protocol");
    }
    return value;
  } catch (error) {
    throw new BusinessError(
      "DATABASE_UNAVAILABLE",
      "数据库连接配置无效",
      503,
      { cause: error },
    );
  }
}

export function getSql() {
  const url = validatedDatabaseUrl();
  if (!url) return null;

  if (!databaseClient) {
    databaseClient = postgres(url, {
      max: process.env.NODE_ENV === "production" ? 1 : 5,
      prepare: false,
    });
  }
  return databaseClient;
}

export function getDb() {
  const sql = getSql();
  if (!sql) return null;

  if (!database) {
    database = drizzle(sql, { schema });
  }
  return database;
}

export async function closeDb() {
  if (databaseClient) {
    await databaseClient.end({ timeout: 5 });
  }
  databaseClient = null;
  database = null;
}

export { schema };

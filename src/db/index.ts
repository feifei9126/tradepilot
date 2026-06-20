import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db === null) {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    try {
      const sql = neon(url);
      _db = drizzle(sql, { schema });
    } catch {
      return null;
    }
  }
  return _db;
}

// Re-export schema for convenience
export { schema };

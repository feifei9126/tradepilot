import { getDb } from "@/db";
import { BusinessError } from "@/lib/business/errors";
import { resolveStorageMode } from "@/lib/business/runtime";

import { createMemoryOrganizationStore, memoryOrganizationStore } from "./memory";
import { createPostgresOrganizationStore } from "./postgres";

export async function getOrganizationStore() {
  if (resolveStorageMode() === "memory") return memoryOrganizationStore;
  const db = getDb();
  if (!db) {
    throw new BusinessError("DATABASE_NOT_CONFIGURED", "Database is not configured", 503);
  }
  return createPostgresOrganizationStore(db);
}

export { createMemoryOrganizationStore };

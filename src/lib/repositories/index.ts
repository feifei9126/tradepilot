import type { BusinessContext } from "@/lib/business/context";
import { getDb } from "@/db";
import { BusinessError } from "@/lib/business/errors";
import { resolveStorageMode } from "@/lib/business/runtime";

import { memoryRepositoryFactory } from "./memory";
import { createPostgresRepository } from "./postgres";

export async function getBusinessRepository(context: BusinessContext) {
  if (resolveStorageMode() === "memory") {
    return memoryRepositoryFactory.forTenant(context);
  }

  const db = getDb();
  if (!db) {
    throw new BusinessError("DATABASE_NOT_CONFIGURED", "数据库未配置", 503);
  }
  return createPostgresRepository(db, context);
}

export type { BusinessRepository, RepositoryFactory } from "./contracts";

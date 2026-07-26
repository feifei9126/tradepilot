import type { BusinessContext } from "@/lib/business/context";
import { getDb } from "@/db";
import { BusinessError } from "@/lib/business/errors";
import { resolveStorageMode } from "@/lib/business/runtime";
import { authorizeBusinessContext } from "@/lib/organizations/access";
import { createPostgresOrganizationStore } from "@/lib/organizations/postgres";

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
  const authorizedContext = await authorizeBusinessContext(
    createPostgresOrganizationStore(db),
    context,
  );
  return createPostgresRepository(db, authorizedContext);
}

export type { BusinessRepository, RepositoryFactory } from "./contracts";

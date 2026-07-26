import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";
import { resolveStorageMode } from "@/lib/business/runtime";

import { memoryRepositoryFactory } from "./memory";

export async function getBusinessRepository(context: BusinessContext) {
  if (resolveStorageMode() === "memory") {
    return memoryRepositoryFactory.forTenant(context);
  }

  throw new BusinessError(
    "DATABASE_SCHEMA_OUTDATED",
    "PostgreSQL 仓库尚未初始化",
    503,
  );
}

export type { BusinessRepository, RepositoryFactory } from "./contracts";

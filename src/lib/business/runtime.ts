import { BusinessError } from "./errors";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_COMPANY_ID = "00000000-0000-4000-8000-000000000002";

export type StorageMode = "memory" | "postgresql";

interface StorageModeInput {
  nodeEnv?: string;
  databaseUrl?: string;
}

export function resolveStorageMode(
  input: StorageModeInput = {
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  },
): StorageMode {
  if (input.databaseUrl?.trim()) return "postgresql";
  if (input.nodeEnv !== "production") return "memory";

  throw new BusinessError(
    "DATABASE_NOT_CONFIGURED",
    "生产环境必须配置 PostgreSQL 数据库",
    503,
  );
}

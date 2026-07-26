import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";

import type { BusinessRepository } from "../contracts";
import { createContactRepository } from "./contacts";
import { createInquiryRepository } from "./inquiries";
import { createOrderRepository } from "./orders";
import { createProductRepository } from "./products";
import { createQuotationRepository } from "./quotations";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

function pending(): never {
  throw new BusinessError(
    "DATABASE_SCHEMA_OUTDATED",
    "PostgreSQL 业务仓库尚未完成初始化",
    503,
  );
}

export function createPostgresRepository(
  db: Database,
  context: BusinessContext,
): BusinessRepository {
  return {
    contacts: createContactRepository(db, context),
    products: createProductRepository(db, context),
    inquiries: createInquiryRepository(db, context),
    quotations: createQuotationRepository(db, context),
    orders: createOrderRepository(db, context),
    shipments: {
      list: async () => pending(),
      get: async () => pending(),
      create: async () => pending(),
      advanceStatus: async () => pending(),
      remove: async () => pending(),
    },
    documents: {
      list: async () => pending(),
      get: async () => pending(),
      listByOrder: async () => pending(),
      generateForOrder: async () => pending(),
      remove: async () => pending(),
    },
    dashboard: {
      snapshot: async () => pending(),
    },
  };
}

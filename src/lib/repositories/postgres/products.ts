import { and, asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { products } from "@/db/schema";
import type { BusinessContext } from "@/lib/business/context";

import type { ProductRepository } from "../contracts";
import { mapProduct, throwRepositoryError } from "./mappers";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

export function createProductRepository(
  db: Database,
  context: BusinessContext,
): ProductRepository {
  return {
    list: async () => {
      try {
        const rows = await db
          .select()
          .from(products)
          .where(eq(products.companyId, context.companyId))
          .orderBy(asc(products.createdAt));
        return rows.map(mapProduct);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    get: async (id) => {
      try {
        const [row] = await db
          .select()
          .from(products)
          .where(
            and(eq(products.companyId, context.companyId), eq(products.id, id)),
          )
          .limit(1);
        return row ? mapProduct(row) : null;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    create: async (input) => {
      try {
        const [row] = await db
          .insert(products)
          .values({
            companyId: context.companyId,
            name: input.name,
            modelNo: input.modelNo || null,
            category: input.category || null,
            hsCode: input.hsCode || null,
            costPrice: input.costPrice?.toString(),
            unit: input.unit,
            moq: input.moq,
            description: input.description || null,
            stockQuantity: input.stockQuantity,
            lowStockThreshold: input.lowStockThreshold,
            warehouse: input.warehouse || null,
            source: input.source || null,
            media: input.media || [],
          })
          .returning();
        return mapProduct(row);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
  };
}

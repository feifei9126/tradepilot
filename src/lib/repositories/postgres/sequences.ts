import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { documentSequences } from "@/db/schema";
import { BusinessError } from "@/lib/business/errors";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

export async function allocateDocumentNumber(
  db: Database,
  companyId: string,
  kind: "quotation" | "order",
  year = new Date().getUTCFullYear(),
) {
  const [row] = await db
    .insert(documentSequences)
    .values({ companyId, kind, year, nextValue: 2 })
    .onConflictDoUpdate({
      target: [
        documentSequences.companyId,
        documentSequences.kind,
        documentSequences.year,
      ],
      set: { nextValue: sql`${documentSequences.nextValue} + 1` },
    })
    .returning({
      allocated: sql<number>`${documentSequences.nextValue} - 1`,
    });
  const allocated = Number(row?.allocated);
  if (!Number.isInteger(allocated) || allocated < 1) {
    throw new BusinessError(
      "DATABASE_SCHEMA_OUTDATED",
      "数据库业务编号状态无效",
      503,
    );
  }
  const prefix = kind === "quotation" ? "QTN" : "ORD";
  return `${prefix}-${year}-${String(allocated).padStart(3, "0")}`;
}

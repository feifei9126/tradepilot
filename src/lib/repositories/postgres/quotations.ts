import { and, asc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { contacts, orders, quotations } from "@/db/schema";
import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";

import type { QuotationRepository } from "../contracts";
import { mapQuotation, throwRepositoryError } from "./mappers";
import { allocateDocumentNumber } from "./sequences";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

export function createQuotationRepository(
  db: Database,
  context: BusinessContext,
): QuotationRepository {
  async function mapRows(rows: (typeof quotations.$inferSelect)[]) {
    if (!rows.length) return [];
    const contactIds = [...new Set(rows.map((row) => row.contactId))];
    const quoteIds = rows.map((row) => row.id);
    const [contactRows, orderRows] = await Promise.all([
      db
        .select({ id: contacts.id, name: contacts.name })
        .from(contacts)
        .where(
          and(
            eq(contacts.companyId, context.companyId),
            inArray(contacts.id, contactIds),
          ),
        ),
      db
        .select({ id: orders.id, quotationId: orders.quotationId })
        .from(orders)
        .where(
          and(
            eq(orders.companyId, context.companyId),
            inArray(orders.quotationId, quoteIds),
          ),
        ),
    ]);
    const contactNames = new Map(contactRows.map((row) => [row.id, row.name]));
    const orderIds = new Map(
      orderRows.flatMap((row) =>
        row.quotationId ? [[row.quotationId, row.id] as const] : [],
      ),
    );
    return rows.map((row) =>
      mapQuotation(
        row,
        contactNames.get(row.contactId) || "",
        orderIds.get(row.id) || null,
      ),
    );
  }

  async function get(id: string) {
    try {
      const [row] = await db
        .select()
        .from(quotations)
        .where(
          and(
            eq(quotations.companyId, context.companyId),
            eq(quotations.id, id),
          ),
        )
        .limit(1);
      return row ? (await mapRows([row]))[0] : null;
    } catch (error) {
      throwRepositoryError(error);
    }
  }

  return {
    list: async () => {
      try {
        const rows = await db
          .select()
          .from(quotations)
          .where(eq(quotations.companyId, context.companyId))
          .orderBy(asc(quotations.createdAt));
        return mapRows(rows);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    get,
    create: async (input) => {
      try {
        const id = await db.transaction(async (transaction) => {
          const [contact] = await transaction
            .select({ id: contacts.id })
            .from(contacts)
            .where(
              and(
                eq(contacts.companyId, context.companyId),
                eq(contacts.id, input.contactId),
              ),
            )
            .limit(1);
          if (!contact) {
            throw new BusinessError("NOT_FOUND", "客户不存在", 404);
          }
          const items = input.items.map((item) => ({
            ...item,
            amount:
              Math.round(
                Number(item.quantity) * Number(item.unitPrice || 0) * 100,
              ) / 100,
          }));
          const totalAmount =
            Math.round(
              items.reduce((sum, item) => sum + Number(item.amount || 0), 0) *
                100,
            ) / 100;
          const quotationNo = await allocateDocumentNumber(
            transaction,
            context.companyId,
            "quotation",
          );
          const [row] = await transaction
            .insert(quotations)
            .values({
              companyId: context.companyId,
              contactId: input.contactId,
              quotationNo,
              itemsJson: items,
              totalAmount: totalAmount.toString(),
              currency: input.currency,
              tradeTerm: input.tradeTerm,
              aiGenerated: input.aiGenerated,
              status: "draft",
            })
            .returning({ id: quotations.id });
          return row.id;
        });
        const created = await get(id);
        if (!created) {
          throw new BusinessError("DATABASE_UNAVAILABLE", "报价创建失败", 503);
        }
        return created;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    updateStatus: async (id, status) => {
      try {
        await db.transaction(async (transaction) => {
          const [row] = await transaction
            .select({ id: quotations.id })
            .from(quotations)
            .where(
              and(
                eq(quotations.companyId, context.companyId),
                eq(quotations.id, id),
              ),
            )
            .for("update")
            .limit(1);
          if (!row) throw new BusinessError("NOT_FOUND", "报价不存在", 404);
          const [order] = await transaction
            .select({ id: orders.id })
            .from(orders)
            .where(
              and(
                eq(orders.companyId, context.companyId),
                eq(orders.quotationId, id),
              ),
            )
            .limit(1);
          if (order) {
            throw new BusinessError(
              "CONFLICT",
              "已转为订单的报价不能再修改状态",
              409,
            );
          }
          await transaction
            .update(quotations)
            .set({ status, updatedAt: new Date() })
            .where(
              and(
                eq(quotations.companyId, context.companyId),
                eq(quotations.id, id),
              ),
            );
        });
        const updated = await get(id);
        if (!updated) throw new BusinessError("NOT_FOUND", "报价不存在", 404);
        return updated;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
  };
}

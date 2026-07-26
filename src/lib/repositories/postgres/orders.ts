import { and, asc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { contacts, orders, quotations } from "@/db/schema";
import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";

import type { OrderRepository } from "../contracts";
import { mapOrder, throwRepositoryError } from "./mappers";
import { allocateDocumentNumber } from "./sequences";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

const minimumProgress: Record<string, number> = {
  in_production: 30,
  inspection: 70,
  ready: 90,
  shipped: 100,
  completed: 100,
};

export function createOrderRepository(
  db: Database,
  context: BusinessContext,
): OrderRepository {
  async function mapRows(rows: (typeof orders.$inferSelect)[]) {
    if (!rows.length) return [];
    const contactIds = [...new Set(rows.map((row) => row.contactId))];
    const contactRows = await db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(
        and(
          eq(contacts.companyId, context.companyId),
          inArray(contacts.id, contactIds),
        ),
      );
    const contactNames = new Map(contactRows.map((row) => [row.id, row.name]));
    return rows.map((row) =>
      mapOrder(row, contactNames.get(row.contactId) || ""),
    );
  }

  async function get(id: string) {
    try {
      const [row] = await db
        .select()
        .from(orders)
        .where(
          and(eq(orders.companyId, context.companyId), eq(orders.id, id)),
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
          .from(orders)
          .where(eq(orders.companyId, context.companyId))
          .orderBy(asc(orders.createdAt));
        return mapRows(rows);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    get,
    createFromQuotation: async (input) => {
      try {
        const id = await db.transaction(async (transaction) => {
          const [quotation] = await transaction
            .select()
            .from(quotations)
            .where(
              and(
                eq(quotations.companyId, context.companyId),
                eq(quotations.id, input.quotationId),
              ),
            )
            .for("update")
            .limit(1);
          if (!quotation) {
            throw new BusinessError("NOT_FOUND", "报价不存在", 404);
          }
          if (quotation.status !== "accepted") {
            throw new BusinessError(
              "CONFLICT",
              "只有已接受报价才能创建订单",
              409,
            );
          }
          const [existing] = await transaction
            .select({ id: orders.id })
            .from(orders)
            .where(
              and(
                eq(orders.companyId, context.companyId),
                eq(orders.quotationId, quotation.id),
              ),
            )
            .limit(1);
          if (existing) {
            throw new BusinessError("CONFLICT", "该报价已创建订单", 409);
          }
          const [contact] = await transaction
            .select({ id: contacts.id })
            .from(contacts)
            .where(
              and(
                eq(contacts.companyId, context.companyId),
                eq(contacts.id, quotation.contactId),
              ),
            )
            .limit(1);
          if (!contact) throw new BusinessError("NOT_FOUND", "客户不存在", 404);
          const orderNo = await allocateDocumentNumber(
            transaction,
            context.companyId,
            "order",
          );
          const [row] = await transaction
            .insert(orders)
            .values({
              companyId: context.companyId,
              quotationId: quotation.id,
              contactId: quotation.contactId,
              contactPersonId: quotation.contactPersonId,
              orderNo,
              status: "confirmed",
              itemsJson: quotation.itemsJson,
              totalAmount: quotation.totalAmount,
              currency: quotation.currency,
              tradeTerm: quotation.tradeTerm,
              deliveryDate: input.deliveryDate,
              progressPercent: 0,
            })
            .returning({ id: orders.id });
          return row.id;
        });
        const created = await get(id);
        if (!created) {
          throw new BusinessError("DATABASE_UNAVAILABLE", "订单创建失败", 503);
        }
        return created;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    update: async (id, patch) => {
      try {
        const current = await get(id);
        if (!current) return null;
        const status = patch.status ?? current.status;
        const progressPercent = Math.max(
          patch.progressPercent ?? current.progressPercent,
          minimumProgress[status] ?? 0,
        );
        const [row] = await db
          .update(orders)
          .set({
            deliveryDate: patch.deliveryDate,
            status: patch.status,
            progressPercent,
            commsJson: patch.comms,
            updatedAt: new Date(),
          })
          .where(
            and(eq(orders.companyId, context.companyId), eq(orders.id, id)),
          )
          .returning();
        return row ? (await mapRows([row]))[0] : null;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
  };
}

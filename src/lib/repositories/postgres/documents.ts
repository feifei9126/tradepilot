import { and, asc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  contactPersons,
  contacts,
  documents,
  orders,
  shipments,
} from "@/db/schema";
import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";

import type { DocumentRepository } from "../contracts";
import {
  mapContact,
  mapDocument,
  mapOrder,
  mapShipment,
  throwRepositoryError,
} from "./mappers";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

export function createDocumentRepository(
  db: Database,
  context: BusinessContext,
): DocumentRepository {
  async function mapRows(rows: (typeof documents.$inferSelect)[]) {
    if (!rows.length) return [];
    const orderIds = [...new Set(rows.map((row) => row.orderId))];
    const orderRows = await db
      .select({ id: orders.id, orderNo: orders.orderNo })
      .from(orders)
      .where(
        and(
          eq(orders.companyId, context.companyId),
          inArray(orders.id, orderIds),
        ),
      );
    const orderNumbers = new Map(
      orderRows.map((row) => [row.id, row.orderNo]),
    );
    return rows.map((row) => {
      const orderNo = orderNumbers.get(row.orderId);
      if (!orderNo) {
        throw new BusinessError(
          "DATABASE_SCHEMA_OUTDATED",
          "单据关联订单无效",
          503,
        );
      }
      return mapDocument(row, orderNo);
    });
  }

  async function get(id: string) {
    try {
      const [row] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.companyId, context.companyId),
            eq(documents.id, id),
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
          .from(documents)
          .where(eq(documents.companyId, context.companyId))
          .orderBy(asc(documents.createdAt));
        return mapRows(rows);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    get,
    listByOrder: async (orderId) => {
      try {
        const rows = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.companyId, context.companyId),
              eq(documents.orderId, orderId),
            ),
          )
          .orderBy(asc(documents.createdAt));
        return mapRows(rows);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    generateForOrder: async (orderId, types) => {
      try {
        const ids = await db.transaction(async (transaction) => {
          const [order] = await transaction
            .select()
            .from(orders)
            .where(
              and(
                eq(orders.companyId, context.companyId),
                eq(orders.id, orderId),
              ),
            )
            .for("update")
            .limit(1);
          if (!order) throw new BusinessError("NOT_FOUND", "订单不存在", 404);

          const [contact] = await transaction
            .select()
            .from(contacts)
            .where(
              and(
                eq(contacts.companyId, context.companyId),
                eq(contacts.id, order.contactId),
              ),
            )
            .limit(1);
          if (!contact) {
            throw new BusinessError("CONFLICT", "订单关联客户不存在", 409);
          }
          const persons = await transaction
            .select()
            .from(contactPersons)
            .where(
              and(
                eq(contactPersons.companyId, context.companyId),
                eq(contactPersons.contactId, contact.id),
              ),
            )
            .orderBy(asc(contactPersons.createdAt));
          const [shipment] = await transaction
            .select()
            .from(shipments)
            .where(
              and(
                eq(shipments.companyId, context.companyId),
                eq(shipments.orderId, order.id),
              ),
            )
            .limit(1);
          const content = JSON.stringify({
            version: 1,
            generatedAt: new Date().toISOString(),
            order: mapOrder(order, contact.name),
            contact: mapContact(contact, persons),
            shipment: shipment
              ? mapShipment(shipment, order.orderNo, contact.name)
              : null,
          });

          const documentIds: string[] = [];
          for (const type of [...new Set(types)]) {
            const [existing] = await transaction
              .select()
              .from(documents)
              .where(
                and(
                  eq(documents.companyId, context.companyId),
                  eq(documents.orderId, order.id),
                  eq(documents.docType, type),
                ),
              )
              .for("update")
              .limit(1);
            if (existing?.status === "generated") {
              documentIds.push(existing.id);
              continue;
            }
            if (existing) {
              const [updated] = await transaction
                .update(documents)
                .set({ status: "generated", content, updatedAt: new Date() })
                .where(
                  and(
                    eq(documents.companyId, context.companyId),
                    eq(documents.id, existing.id),
                  ),
                )
                .returning({ id: documents.id });
              documentIds.push(updated.id);
              continue;
            }
            const [created] = await transaction
              .insert(documents)
              .values({
                companyId: context.companyId,
                orderId: order.id,
                docType: type,
                status: "generated",
                content,
              })
              .returning({ id: documents.id });
            documentIds.push(created.id);
          }
          return documentIds;
        });
        const results = await Promise.all(ids.map((id) => get(id)));
        return results.flatMap((document) => (document ? [document] : []));
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    remove: async (id) => {
      try {
        const rows = await db
          .delete(documents)
          .where(
            and(
              eq(documents.companyId, context.companyId),
              eq(documents.id, id),
            ),
          )
          .returning({ id: documents.id });
        return rows.length > 0;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
  };
}

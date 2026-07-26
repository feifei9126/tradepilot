import { and, asc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { contacts, orders, shipments } from "@/db/schema";
import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";
import type { StoredShipment } from "@/lib/business/types";

import type { ShipmentRepository } from "../contracts";
import { mapShipment, throwRepositoryError } from "./mappers";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

const shipmentStatuses: StoredShipment["status"][] = [
  "booked",
  "departed",
  "in_transit",
  "delivered",
];

export function createShipmentRepository(
  db: Database,
  context: BusinessContext,
): ShipmentRepository {
  async function mapRows(rows: (typeof shipments.$inferSelect)[]) {
    if (!rows.length) return [];
    const orderIds = [...new Set(rows.map((row) => row.orderId))];
    const orderRows = await db
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        customer: contacts.name,
      })
      .from(orders)
      .innerJoin(
        contacts,
        and(
          eq(contacts.companyId, context.companyId),
          eq(contacts.id, orders.contactId),
        ),
      )
      .where(
        and(
          eq(orders.companyId, context.companyId),
          inArray(orders.id, orderIds),
        ),
      );
    const orderDetails = new Map(
      orderRows.map((row) => [
        row.id,
        { orderNo: row.orderNo, customer: row.customer },
      ]),
    );
    return rows.map((row) => {
      const order = orderDetails.get(row.orderId);
      if (!order) {
        throw new BusinessError(
          "DATABASE_SCHEMA_OUTDATED",
          "物流记录关联订单无效",
          503,
        );
      }
      return mapShipment(row, order.orderNo, order.customer);
    });
  }

  async function get(id: string) {
    try {
      const [row] = await db
        .select()
        .from(shipments)
        .where(
          and(
            eq(shipments.companyId, context.companyId),
            eq(shipments.id, id),
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
          .from(shipments)
          .where(eq(shipments.companyId, context.companyId))
          .orderBy(asc(shipments.createdAt));
        return mapRows(rows);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    get,
    create: async (input) => {
      try {
        const id = await db.transaction(async (transaction) => {
          const [order] = await transaction
            .select({ id: orders.id, status: orders.status })
            .from(orders)
            .where(
              and(
                eq(orders.companyId, context.companyId),
                eq(orders.id, input.orderId),
              ),
            )
            .for("update")
            .limit(1);
          if (!order) throw new BusinessError("NOT_FOUND", "订单不存在", 404);
          if (order.status === "cancelled" || order.status === "completed") {
            throw new BusinessError("CONFLICT", "当前订单不能创建物流记录", 409);
          }
          const [existing] = await transaction
            .select({ id: shipments.id })
            .from(shipments)
            .where(
              and(
                eq(shipments.companyId, context.companyId),
                eq(shipments.orderId, order.id),
              ),
            )
            .limit(1);
          if (existing) {
            throw new BusinessError("CONFLICT", "该订单已有物流记录", 409);
          }
          const [row] = await transaction
            .insert(shipments)
            .values({
              companyId: context.companyId,
              orderId: order.id,
              method: input.method,
              carrier: input.carrier,
              referenceNo: input.referenceNo,
              etd: input.etd,
              eta: input.eta,
              status: "booked",
            })
            .returning({ id: shipments.id });
          return row.id;
        });
        const created = await get(id);
        if (!created) {
          throw new BusinessError("DATABASE_UNAVAILABLE", "物流创建失败", 503);
        }
        return created;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    advanceStatus: async (id, status) => {
      try {
        await db.transaction(async (transaction) => {
          const [shipment] = await transaction
            .select()
            .from(shipments)
            .where(
              and(
                eq(shipments.companyId, context.companyId),
                eq(shipments.id, id),
              ),
            )
            .for("update")
            .limit(1);
          if (!shipment) {
            throw new BusinessError("NOT_FOUND", "物流记录不存在", 404);
          }
          const currentIndex = shipmentStatuses.indexOf(
            shipment.status as StoredShipment["status"],
          );
          const nextIndex = shipmentStatuses.indexOf(status);
          if (currentIndex < 0) {
            throw new BusinessError(
              "DATABASE_SCHEMA_OUTDATED",
              "物流状态无效",
              503,
            );
          }
          if (nextIndex < currentIndex) {
            throw new BusinessError("CONFLICT", "物流状态不能回退", 409);
          }
          const [order] = await transaction
            .select({ id: orders.id, status: orders.status })
            .from(orders)
            .where(
              and(
                eq(orders.companyId, context.companyId),
                eq(orders.id, shipment.orderId),
              ),
            )
            .for("update")
            .limit(1);
          if (!order) {
            throw new BusinessError("CONFLICT", "关联订单不存在", 409);
          }
          if (order.status === "cancelled") {
            throw new BusinessError("CONFLICT", "已取消订单不能推进出货", 409);
          }
          await transaction
            .update(shipments)
            .set({ status, updatedAt: new Date() })
            .where(
              and(
                eq(shipments.companyId, context.companyId),
                eq(shipments.id, shipment.id),
              ),
            );
          if (status === "departed" || status === "in_transit") {
            await transaction
              .update(orders)
              .set({
                status: "shipped",
                progressPercent: 100,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(orders.companyId, context.companyId),
                  eq(orders.id, order.id),
                ),
              );
          } else if (status === "delivered") {
            await transaction
              .update(orders)
              .set({
                status: "completed",
                progressPercent: 100,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(orders.companyId, context.companyId),
                  eq(orders.id, order.id),
                ),
              );
          }
        });
        const updated = await get(id);
        if (!updated) {
          throw new BusinessError("NOT_FOUND", "物流记录不存在", 404);
        }
        return updated;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    remove: async (id) => {
      try {
        const rows = await db
          .delete(shipments)
          .where(
            and(
              eq(shipments.companyId, context.companyId),
              eq(shipments.id, id),
            ),
          )
          .returning({ id: shipments.id });
        return rows.length > 0;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
  };
}

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  communications,
  contactPersons,
  contacts,
  inquiries,
  orders,
  quotations,
} from "@/db/schema";
import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";
import type {
  ContactCreateInput,
  StoredContact,
} from "@/lib/business/types";

import type { ContactRepository } from "../contracts";
import { mapContact, throwRepositoryError } from "./mappers";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

function dateValue(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizedPersons(input: ContactCreateInput | StoredContact) {
  if (input.persons?.length) {
    return input.persons.map((person, index) => ({
      name: person.name,
      position: person.position || null,
      phone: person.phone || null,
      email: person.email || null,
      isPrimary: person.isPrimary ?? index === 0,
    }));
  }
  if (input.email || input.phone) {
    return [
      {
        name: input.name,
        position: null,
        phone: input.phone || null,
        email: input.email || null,
        isPrimary: true,
      },
    ];
  }
  return [];
}

async function insertRelated(
  db: Database,
  companyId: string,
  contactId: string,
  input: ContactCreateInput,
) {
  const persons = normalizedPersons(input);
  if (persons.length) {
    await db.insert(contactPersons).values(
      persons.map((person) => ({ ...person, companyId, contactId })),
    );
  }
  if (input.activities?.length) {
    await db.insert(communications).values(
      input.activities.map((activity) => ({
        companyId,
        contactId,
        channel: activity.type,
        rawContent: activity.note,
        occurredAt: dateValue(activity.date),
      })),
    );
  }
}

async function insertContact(
  db: Database,
  companyId: string,
  input: ContactCreateInput,
) {
  const [row] = await db
    .insert(contacts)
    .values({
      companyId,
      name: input.name,
      country: input.country || null,
      source: input.source || null,
      tags: input.tags || [],
      notes: input.notes || null,
      grade: input.grade || null,
      stage: input.stage || null,
      lastContactedAt: dateValue(input.lastContactedAt),
      nextFollowUpAt: dateValue(input.nextFollowUpAt),
      createdAt: dateValue(input.createdAt) || undefined,
    })
    .returning();
  await insertRelated(db, companyId, row.id, input);
  return row.id;
}

export function createContactRepository(
  db: Database,
  context: BusinessContext,
): ContactRepository {
  async function loadRows(rows: (typeof contacts.$inferSelect)[]) {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const [persons, activities] = await Promise.all([
      db
        .select()
        .from(contactPersons)
        .where(
          and(
            eq(contactPersons.companyId, context.companyId),
            inArray(contactPersons.contactId, ids),
          ),
        )
        .orderBy(asc(contactPersons.createdAt)),
      db
        .select()
        .from(communications)
        .where(
          and(
            eq(communications.companyId, context.companyId),
            inArray(communications.contactId, ids),
            isNull(communications.orderId),
          ),
        )
        .orderBy(asc(communications.occurredAt)),
    ]);
    return rows.map((row) =>
      mapContact(
        row,
        persons.filter((person) => person.contactId === row.id),
        activities.filter((activity) => activity.contactId === row.id),
      ),
    );
  }

  async function get(id: string) {
    try {
      const [row] = await db
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.companyId, context.companyId), eq(contacts.id, id)),
        )
        .limit(1);
      if (!row) return null;
      return (await loadRows([row]))[0];
    } catch (error) {
      throwRepositoryError(error);
    }
  }

  return {
    list: async () => {
      try {
        const rows = await db
          .select()
          .from(contacts)
          .where(eq(contacts.companyId, context.companyId))
          .orderBy(asc(contacts.createdAt));
        return loadRows(rows);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    get,
    create: async (input) => {
      try {
        const id = await db.transaction((transaction) =>
          insertContact(transaction, context.companyId, input),
        );
        const created = await get(id);
        if (!created) {
          throw new BusinessError("DATABASE_UNAVAILABLE", "客户创建失败", 503);
        }
        return created;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    importBatch: async (inputs) => {
      try {
        const ids = await db.transaction(async (transaction) => {
          const created: string[] = [];
          for (const input of inputs) {
            created.push(
              await insertContact(transaction, context.companyId, input),
            );
          }
          return created;
        });
        const rows = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.companyId, context.companyId),
              inArray(contacts.id, ids),
            ),
          );
        const mapped = await loadRows(rows);
        return ids.map((id) => mapped.find((contact) => contact.id === id)!);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    update: async (id, patch) => {
      try {
        const exists = await get(id);
        if (!exists) return null;
        await db.transaction(async (transaction) => {
          const values: Partial<typeof contacts.$inferInsert> = {};
          if (patch.name !== undefined) values.name = patch.name;
          if (patch.country !== undefined) values.country = patch.country || null;
          if (patch.source !== undefined) values.source = patch.source || null;
          if (patch.tags !== undefined) values.tags = patch.tags;
          if (patch.notes !== undefined) values.notes = patch.notes || null;
          if (patch.grade !== undefined) values.grade = patch.grade || null;
          if (patch.stage !== undefined) values.stage = patch.stage || null;
          if (patch.lastContactedAt !== undefined) {
            values.lastContactedAt = dateValue(patch.lastContactedAt);
          }
          if (patch.nextFollowUpAt !== undefined) {
            values.nextFollowUpAt = dateValue(patch.nextFollowUpAt);
          }
          if (Object.keys(values).length) {
            await transaction
              .update(contacts)
              .set({ ...values, updatedAt: new Date() })
              .where(
                and(
                  eq(contacts.companyId, context.companyId),
                  eq(contacts.id, id),
                ),
              );
          }

          if (patch.persons !== undefined) {
            await transaction
              .update(inquiries)
              .set({ contactPersonId: null })
              .where(
                and(
                  eq(inquiries.companyId, context.companyId),
                  eq(inquiries.contactId, id),
                ),
              );
            await transaction
              .delete(contactPersons)
              .where(
                and(
                  eq(contactPersons.companyId, context.companyId),
                  eq(contactPersons.contactId, id),
                ),
              );
            const persons = normalizedPersons({ ...exists, ...patch });
            if (persons.length) {
              await transaction.insert(contactPersons).values(
                persons.map((person) => ({
                  ...person,
                  companyId: context.companyId,
                  contactId: id,
                })),
              );
            }
          } else if (patch.email !== undefined || patch.phone !== undefined) {
            const [primary] = await transaction
              .select()
              .from(contactPersons)
              .where(
                and(
                  eq(contactPersons.companyId, context.companyId),
                  eq(contactPersons.contactId, id),
                  eq(contactPersons.isPrimary, true),
                ),
              )
              .limit(1);
            if (primary) {
              await transaction
                .update(contactPersons)
                .set({
                  email: patch.email ?? primary.email,
                  phone: patch.phone ?? primary.phone,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(contactPersons.companyId, context.companyId),
                    eq(contactPersons.id, primary.id),
                  ),
                );
            } else if (patch.email || patch.phone) {
              await transaction.insert(contactPersons).values({
                companyId: context.companyId,
                contactId: id,
                name: patch.name || exists.name,
                email: patch.email || null,
                phone: patch.phone || null,
                isPrimary: true,
              });
            }
          }
        });
        return get(id);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    removeIfUnreferenced: async (id) => {
      try {
        return await db.transaction(async (transaction) => {
          const [contact] = await transaction
            .select({ id: contacts.id })
            .from(contacts)
            .where(
              and(
                eq(contacts.companyId, context.companyId),
                eq(contacts.id, id),
              ),
            )
            .limit(1);
          if (!contact) return false;
          const [quotation, order] = await Promise.all([
            transaction
              .select({ id: quotations.id })
              .from(quotations)
              .where(
                and(
                  eq(quotations.companyId, context.companyId),
                  eq(quotations.contactId, id),
                ),
              )
              .limit(1),
            transaction
              .select({ id: orders.id })
              .from(orders)
              .where(
                and(
                  eq(orders.companyId, context.companyId),
                  eq(orders.contactId, id),
                ),
              )
              .limit(1),
          ]);
          if (quotation.length || order.length) {
            throw new BusinessError(
              "CONFLICT",
              "客户已关联报价或订单，不能删除",
              409,
            );
          }
          await transaction
            .update(inquiries)
            .set({ contactId: null, contactPersonId: null })
            .where(
              and(
                eq(inquiries.companyId, context.companyId),
                eq(inquiries.contactId, id),
              ),
            );
          await transaction
            .update(communications)
            .set({ contactId: null })
            .where(
              and(
                eq(communications.companyId, context.companyId),
                eq(communications.contactId, id),
              ),
            );
          const deleted = await transaction
            .delete(contacts)
            .where(
              and(
                eq(contacts.companyId, context.companyId),
                eq(contacts.id, id),
              ),
            )
            .returning({ id: contacts.id });
          return deleted.length > 0;
        });
      } catch (error) {
        throwRepositoryError(error);
      }
    },
  };
}

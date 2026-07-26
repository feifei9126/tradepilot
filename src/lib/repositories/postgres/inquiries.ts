import { and, asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { contacts, inquiries } from "@/db/schema";
import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";

import type { InquiryRepository } from "../contracts";
import { mapInquiry, throwRepositoryError } from "./mappers";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

export function createInquiryRepository(
  db: Database,
  context: BusinessContext,
): InquiryRepository {
  return {
    list: async () => {
      try {
        const rows = await db
          .select()
          .from(inquiries)
          .where(eq(inquiries.companyId, context.companyId))
          .orderBy(asc(inquiries.createdAt));
        return rows.map(mapInquiry);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    get: async (id) => {
      try {
        const [row] = await db
          .select()
          .from(inquiries)
          .where(
            and(
              eq(inquiries.companyId, context.companyId),
              eq(inquiries.id, id),
            ),
          )
          .limit(1);
        return row ? mapInquiry(row) : null;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    create: async (input) => {
      try {
        if (input.contactId) {
          const [contact] = await db
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
            throw new BusinessError("NOT_FOUND", "关联客户不存在", 404);
          }
        }
        const [row] = await db
          .insert(inquiries)
          .values({
            companyId: context.companyId,
            contactId: input.contactId || null,
            customerName: input.customer,
            subject: input.subject,
            source: input.source,
            rawText: input.content,
            status: "pending",
          })
          .returning();
        return mapInquiry(row);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    update: async (id, patch) => {
      try {
        const [row] = await db
          .update(inquiries)
          .set({
            status: patch.status,
            aiReply: patch.aiReply,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(inquiries.companyId, context.companyId),
              eq(inquiries.id, id),
            ),
          )
          .returning();
        return row ? mapInquiry(row) : null;
      } catch (error) {
        throwRepositoryError(error);
      }
    },
  };
}

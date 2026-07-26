import { getDb } from "@/db";
import { BusinessError } from "@/lib/business/errors";
import { resolveStorageMode } from "@/lib/business/runtime";
import { requireOrganizationMembership, requireOrganizationPermission } from "@/lib/organizations/access";
import type { BusinessContext } from "@/lib/business/context";
import type { OrganizationAction } from "@/lib/organizations/permissions";
import { getOrganizationStore } from "@/lib/organizations/runtime";
import { createPostgresPaymentRepository } from "./repository";

export async function authorizePaymentContext(context: BusinessContext, action: Extract<OrganizationAction, "payments:create" | "payments:configure" | "payments:refund">) {
  const membership = await requireOrganizationMembership(await getOrganizationStore(), context.userId, context.companyId);
  requireOrganizationPermission(membership, action);
  return { ...context, role: membership.role } satisfies BusinessContext;
}

export function getPostgresPaymentRepository() {
  if (resolveStorageMode() !== "postgresql") throw new BusinessError("PROVIDER_NOT_CONFIGURED", "Payment persistence requires PostgreSQL", 503);
  const db = getDb();
  if (!db) throw new BusinessError("DATABASE_NOT_CONFIGURED", "Database is not configured", 503);
  return createPostgresPaymentRepository(db);
}

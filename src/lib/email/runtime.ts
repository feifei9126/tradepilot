import { getDb } from "@/db";
import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";
import { resolveStorageMode } from "@/lib/business/runtime";
import {
  requireOrganizationMembership,
  requireOrganizationPermission,
} from "@/lib/organizations/access";
import type { OrganizationAction } from "@/lib/organizations/permissions";
import { getOrganizationStore } from "@/lib/organizations/runtime";

import { createPostgresEmailRepository } from "./repository";

export async function authorizeEmailContext(
  context: BusinessContext,
  action: Extract<OrganizationAction, "email:use" | "email:configure">,
) {
  const membership = await requireOrganizationMembership(
    await getOrganizationStore(),
    context.userId,
    context.companyId,
  );
  requireOrganizationPermission(membership, action);
  return { ...context, role: membership.role } satisfies BusinessContext;
}

export function getPostgresEmailRepository() {
  if (resolveStorageMode() !== "postgresql") {
    throw new BusinessError(
      "PROVIDER_NOT_CONFIGURED",
      "Email account persistence requires PostgreSQL",
      503,
    );
  }
  const db = getDb();
  if (!db) {
    throw new BusinessError("DATABASE_NOT_CONFIGURED", "Database is not configured", 503);
  }
  return createPostgresEmailRepository(db);
}

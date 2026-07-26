import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";

import { canPerformOrganizationAction, type OrganizationAction } from "./permissions";
import type { OrganizationMembership, OrganizationStore } from "./types";

export async function requireOrganizationMembership(
  store: Pick<OrganizationStore, "getMembership">,
  userId: string,
  companyId: string,
) {
  const membership = await store.getMembership(companyId, userId);
  if (!membership || membership.status !== "active") {
    throw new BusinessError(
      "MEMBERSHIP_REQUIRED",
      "Active organization membership is required",
      403,
    );
  }
  return membership;
}

export function requireOrganizationPermission(
  membership: OrganizationMembership,
  action: OrganizationAction,
) {
  if (!canPerformOrganizationAction(membership.role, action)) {
    throw new BusinessError(
      "ROLE_REQUIRED",
      "Your organization role cannot perform this action",
      403,
    );
  }
}

export async function authorizeBusinessContext(
  store: Pick<OrganizationStore, "getMembership">,
  context: BusinessContext,
) {
  const membership = await requireOrganizationMembership(
    store,
    context.userId,
    context.companyId,
  );
  return { ...context, role: membership.role } satisfies BusinessContext;
}

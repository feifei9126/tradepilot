import type { OrganizationRole } from "@/db/schema/organization_memberships";

export type OrganizationAction =
  | "business:read"
  | "business:write"
  | "email:use"
  | "email:configure"
  | "payments:create"
  | "payments:configure"
  | "payments:refund"
  | "members:manage-member"
  | "members:manage-owner"
  | "organization:manage";

const permissions: Record<OrganizationRole, ReadonlySet<OrganizationAction>> = {
  owner: new Set([
    "business:read",
    "business:write",
    "email:use",
    "email:configure",
    "payments:create",
    "payments:configure",
    "payments:refund",
    "members:manage-member",
    "members:manage-owner",
    "organization:manage",
  ]),
  admin: new Set([
    "business:read",
    "business:write",
    "email:use",
    "email:configure",
    "payments:create",
    "payments:configure",
    "payments:refund",
    "members:manage-member",
  ]),
  member: new Set([
    "business:read",
    "business:write",
    "email:use",
    "payments:create",
  ]),
  viewer: new Set(["business:read", "email:use"]),
};

export function canPerformOrganizationAction(
  role: string,
  action: OrganizationAction,
) {
  return permissions[role as OrganizationRole]?.has(action) === true;
}

export function requireOrganizationAction(
  role: string,
  action: OrganizationAction,
) {
  return canPerformOrganizationAction(role, action);
}

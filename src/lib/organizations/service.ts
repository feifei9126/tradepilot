import { randomBytes, randomUUID } from "node:crypto";

import { BusinessError } from "@/lib/business/errors";
import {
  organizationRoles,
  type OrganizationRole,
} from "@/db/schema/organization_memberships";

import { hashInvitationToken } from "./memory";
import type {
  CreateInvitationInput,
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationStore,
} from "./types";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validateRole(role: string): OrganizationRole {
  if ((organizationRoles as readonly string[]).includes(role)) {
    return role as OrganizationRole;
  }
  throw new BusinessError("VALIDATION_ERROR", "Invalid organization role", 400);
}

function validateStatus(status: string) {
  if (status === "active" || status === "suspended") return status;
  throw new BusinessError("VALIDATION_ERROR", "Invalid membership status", 400);
}

function validateEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (normalized.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new BusinessError("VALIDATION_ERROR", "Invalid invitation email", 400);
  }
  return normalized;
}

export async function createInvitation(
  store: OrganizationStore,
  input: CreateInvitationInput,
) {
  const email = validateEmail(input.email);
  const role = validateRole(input.role);
  const createdAt = new Date();
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= createdAt) {
    throw new BusinessError("VALIDATION_ERROR", "Invitation expiry is invalid", 400);
  }

  const rawToken = randomBytes(32).toString("base64url");
  const invitation: OrganizationInvitation = {
    id: randomUUID(),
    companyId: input.companyId,
    email,
    role,
    tokenHash: hashInvitationToken(rawToken),
    invitedBy: input.invitedBy,
    expiresAt: expiresAt.toISOString(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: createdAt.toISOString(),
  };
  const stored = await store.createInvitation(invitation);
  return { invitation: stored, rawToken };
}

export async function acceptInvitation(
  store: OrganizationStore,
  rawToken: string,
  email: string,
  userId: string,
): Promise<{ membership: OrganizationMembership }> {
  if (!rawToken || rawToken.length < 32) {
    throw new BusinessError("INVITATION_NOT_FOUND", "Invitation not found", 404);
  }
  const membership = await store.consumeInvitation({
    tokenHash: hashInvitationToken(rawToken),
    email: validateEmail(email),
    userId,
    now: new Date().toISOString(),
  });
  return { membership };
}

export async function updateOrganizationMember(
  store: OrganizationStore,
  input: {
    companyId: string;
    actorUserId: string;
    userId: string;
    role?: string;
    status?: string;
  },
) {
  const actor = await store.getMembership(input.companyId, input.actorUserId);
  if (!actor || actor.status !== "active") {
    throw new BusinessError("MEMBERSHIP_REQUIRED", "Active organization membership is required", 403);
  }
  if (input.role === "owner") {
    if (actor.role !== "owner") {
      throw new BusinessError("ROLE_REQUIRED", "Only owners can grant owner role", 403);
    }
  } else if (actor.role !== "owner" && actor.role !== "admin") {
    throw new BusinessError("ROLE_REQUIRED", "Only admins can manage members", 403);
  }

  const target = await store.getMembership(input.companyId, input.userId);
  if (!target) throw new BusinessError("NOT_FOUND", "Organization member not found", 404);
  const nextRole = input.role === undefined ? target.role : validateRole(input.role);
  const nextStatus = input.status === undefined ? target.status : validateStatus(input.status);
  if ((target.role === "owner" || nextRole === "owner") && actor.role !== "owner") {
    throw new BusinessError("ROLE_REQUIRED", "Only owners can manage owners", 403);
  }
  if (
    target.role === "owner" &&
    target.status === "active" &&
    (nextRole !== "owner" || nextStatus !== "active")
  ) {
    const owners = (await store.listMemberships(input.companyId)).filter(
      (membership) => membership.role === "owner" && membership.status === "active",
    );
    if (owners.length <= 1) {
      throw new BusinessError("LAST_OWNER_REQUIRED", "An organization must keep at least one active owner", 409);
    }
  }
  if (target.userId === actor.userId && nextStatus === "suspended") {
    throw new BusinessError("ROLE_REQUIRED", "You cannot suspend your own membership", 403);
  }
  const updated = await store.updateMembership(input.companyId, input.userId, {
    role: nextRole,
    status: nextStatus,
  });
  if (!updated) throw new BusinessError("NOT_FOUND", "Organization member not found", 404);
  return updated;
}

export async function revokeOrganizationInvitation(
  store: OrganizationStore,
  input: { companyId: string; actorUserId: string; invitationId: string },
) {
  const actor = await store.getMembership(input.companyId, input.actorUserId);
  if (!actor || actor.status !== "active") {
    throw new BusinessError("MEMBERSHIP_REQUIRED", "Active organization membership is required", 403);
  }
  if (actor.role !== "owner" && actor.role !== "admin") {
    throw new BusinessError("ROLE_REQUIRED", "Only admins can revoke invitations", 403);
  }
  const invitation = await store.listInvitations(input.companyId);
  const target = invitation.find((item) => item.id === input.invitationId);
  if (!target) throw new BusinessError("NOT_FOUND", "Invitation not found", 404);
  if (target.revokedAt || target.acceptedAt) return target;
  const updated = await store.updateInvitation(target.id, {
    revokedAt: new Date().toISOString(),
  });
  if (!updated) throw new BusinessError("NOT_FOUND", "Invitation not found", 404);
  return updated;
}

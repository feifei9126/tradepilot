import { createHash } from "node:crypto";

import { BusinessError } from "@/lib/business/errors";

import type {
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationSummary,
  OrganizationStore,
} from "./types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createMemoryOrganizationStore(): OrganizationStore {
  const memberships = new Map<string, OrganizationMembership>();
  const invitations = new Map<string, OrganizationInvitation>();

  return {
    async getMembership(companyId, userId) {
      const value = memberships.get(`${companyId}:${userId}`);
      return value ? clone(value) : null;
    },
    async listMemberships(companyId) {
      return clone(
        [...memberships.values()].filter((value) => value.companyId === companyId),
      );
    },
    async listOrganizationsForUser(userId): Promise<OrganizationSummary[]> {
      return clone(
        [...memberships.values()]
          .filter((value) => value.userId === userId)
          .map((value) => ({
            companyId: value.companyId,
            name: value.companyId === "00000000-0000-4000-8000-000000000002"
              ? "TradePilot Demo"
              : `Organization ${value.companyId.slice(0, 8)}`,
            slug: value.companyId,
            role: value.role,
            status: value.status,
          })),
      );
    },
    async createMembership(input) {
      const key = `${input.companyId}:${input.userId}`;
      const value = clone(input);
      memberships.set(key, value);
      return clone(value);
    },
    async updateMembership(companyId, userId, patch) {
      const key = `${companyId}:${userId}`;
      const current = memberships.get(key);
      if (!current) return null;
      const next = { ...current, ...clone(patch), companyId, userId };
      memberships.set(key, next);
      return clone(next);
    },
    async createInvitation(input) {
      const value = clone(input);
      invitations.set(value.id, value);
      return clone(value);
    },
    async listInvitations(companyId) {
      return clone(
        [...invitations.values()]
          .filter((value) => value.companyId === companyId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    async getInvitationByTokenHash(tokenHash) {
      const value = [...invitations.values()].find(
        (invitation) => invitation.tokenHash === tokenHash,
      );
      return value ? clone(value) : null;
    },
    async consumeInvitation({ tokenHash, email, userId, now }) {
      const invitation = [...invitations.values()].find(
        (value) => value.tokenHash === tokenHash,
      );
      if (!invitation) {
        throw new BusinessError(
          "INVITATION_NOT_FOUND",
          "Invitation not found",
          404,
        );
      }
      if (invitation.acceptedAt) {
        throw new BusinessError(
          "INVITATION_CONSUMED",
          "Invitation has already been used",
          409,
        );
      }
      if (invitation.revokedAt) {
        throw new BusinessError(
          "INVITATION_REVOKED",
          "Invitation has been revoked",
          409,
        );
      }
      if (new Date(invitation.expiresAt).getTime() <= new Date(now).getTime()) {
        throw new BusinessError(
          "INVITATION_EXPIRED",
          "Invitation has expired",
          410,
        );
      }
      if (invitation.email !== email) {
        throw new BusinessError(
          "INVITATION_EMAIL_MISMATCH",
          "Invitation email does not match",
          403,
        );
      }
      const key = `${invitation.companyId}:${userId}`;
      const existing = memberships.get(key);
      const membership: OrganizationMembership = existing
        ? { ...existing, status: "active", role: invitation.role, updatedAt: now }
        : {
            companyId: invitation.companyId,
            userId,
            role: invitation.role,
            status: "active",
            createdBy: invitation.invitedBy,
            createdAt: now,
            updatedAt: now,
          };
      memberships.set(key, membership);
      invitation.acceptedAt = now;
      invitations.set(invitation.id, invitation);
      return clone(membership);
    },
    async updateInvitation(id, patch) {
      const current = invitations.get(id);
      if (!current) return null;
      const next = { ...current, ...clone(patch), id };
      invitations.set(id, next);
      return clone(next);
    },
  };
}

export const memoryOrganizationStore = createMemoryOrganizationStore();
void memoryOrganizationStore.createMembership({
  companyId: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000001",
  role: "owner",
  status: "active",
  createdBy: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

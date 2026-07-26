import { createHash } from "node:crypto";

import type {
  OrganizationInvitation,
  OrganizationMembership,
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
    async getInvitationByTokenHash(tokenHash) {
      const value = [...invitations.values()].find(
        (invitation) => invitation.tokenHash === tokenHash,
      );
      return value ? clone(value) : null;
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

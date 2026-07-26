import { and, asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { organizationInvitations, organizationMemberships } from "@/db/schema";

import type {
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationStore,
} from "./types";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

function role(value: string): OrganizationMembership["role"] {
  return value === "owner" || value === "admin" || value === "viewer"
    ? value
    : "member";
}

function status(value: string): OrganizationMembership["status"] {
  return value === "suspended" ? "suspended" : "active";
}

function iso(value: Date | null | undefined) {
  return (value || new Date(0)).toISOString();
}

function mapMembership(row: typeof organizationMemberships.$inferSelect): OrganizationMembership {
  return {
    companyId: row.companyId,
    userId: row.userId,
    role: role(row.role),
    status: status(row.status),
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function mapInvitation(row: typeof organizationInvitations.$inferSelect): OrganizationInvitation {
  return {
    id: row.id,
    companyId: row.companyId,
    email: row.email,
    role: role(row.role),
    tokenHash: row.tokenHash,
    invitedBy: row.invitedBy,
    expiresAt: iso(row.expiresAt),
    acceptedAt: row.acceptedAt?.toISOString() || null,
    revokedAt: row.revokedAt?.toISOString() || null,
    createdAt: iso(row.createdAt),
  };
}

export function createPostgresOrganizationStore(db: Database): OrganizationStore {
  return {
    async getMembership(companyId, userId) {
      const [row] = await db
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.companyId, companyId),
            eq(organizationMemberships.userId, userId),
          ),
        )
        .limit(1);
      return row ? mapMembership(row) : null;
    },
    async listMemberships(companyId) {
      const rows = await db
        .select()
        .from(organizationMemberships)
        .where(eq(organizationMemberships.companyId, companyId))
        .orderBy(asc(organizationMemberships.createdAt));
      return rows.map(mapMembership);
    },
    async createMembership(input) {
      const [row] = await db
        .insert(organizationMemberships)
        .values({
          companyId: input.companyId,
          userId: input.userId,
          role: input.role,
          status: input.status,
          createdBy: input.createdBy || null,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt),
        })
        .returning();
      return mapMembership(row);
    },
    async updateMembership(companyId, userId, patch) {
      const [row] = await db
        .update(organizationMemberships)
        .set({
          ...(patch.role ? { role: patch.role } : {}),
          ...(patch.status ? { status: patch.status } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(organizationMemberships.companyId, companyId),
            eq(organizationMemberships.userId, userId),
          ),
        )
        .returning();
      return row ? mapMembership(row) : null;
    },
    async createInvitation(input) {
      const [row] = await db
        .insert(organizationInvitations)
        .values({
          id: input.id,
          companyId: input.companyId,
          email: input.email,
          role: input.role,
          tokenHash: input.tokenHash,
          invitedBy: input.invitedBy,
          expiresAt: new Date(input.expiresAt),
          acceptedAt: input.acceptedAt ? new Date(input.acceptedAt) : null,
          revokedAt: input.revokedAt ? new Date(input.revokedAt) : null,
          createdAt: new Date(input.createdAt),
        })
        .returning();
      return mapInvitation(row);
    },
    async getInvitationByTokenHash(tokenHash) {
      const [row] = await db
        .select()
        .from(organizationInvitations)
        .where(eq(organizationInvitations.tokenHash, tokenHash))
        .limit(1);
      return row ? mapInvitation(row) : null;
    },
    async updateInvitation(id, patch) {
      const [row] = await db
        .update(organizationInvitations)
        .set({
          ...(patch.acceptedAt !== undefined
            ? { acceptedAt: patch.acceptedAt ? new Date(patch.acceptedAt) : null }
            : {}),
          ...(patch.revokedAt !== undefined
            ? { revokedAt: patch.revokedAt ? new Date(patch.revokedAt) : null }
            : {}),
        })
        .where(eq(organizationInvitations.id, id))
        .returning();
      return row ? mapInvitation(row) : null;
    },
  };
}

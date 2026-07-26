import { and, asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  companies,
  organizationInvitations,
  organizationMemberships,
} from "@/db/schema";
import { BusinessError } from "@/lib/business/errors";

import type {
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationSummary,
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
    async listOrganizationsForUser(userId): Promise<OrganizationSummary[]> {
      const rows = await db
        .select({
          companyId: organizationMemberships.companyId,
          name: companies.name,
          slug: companies.slug,
          role: organizationMemberships.role,
          status: organizationMemberships.status,
        })
        .from(organizationMemberships)
        .innerJoin(companies, eq(companies.id, organizationMemberships.companyId))
        .where(eq(organizationMemberships.userId, userId))
        .orderBy(asc(companies.name));
      return rows.map((row) => ({
        companyId: row.companyId,
        name: row.name,
        slug: row.slug,
        role: role(row.role),
        status: status(row.status),
      }));
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
    async listInvitations(companyId) {
      const rows = await db
        .select()
        .from(organizationInvitations)
        .where(eq(organizationInvitations.companyId, companyId))
        .orderBy(asc(organizationInvitations.createdAt));
      return rows.map(mapInvitation);
    },
    async getInvitationByTokenHash(tokenHash) {
      const [row] = await db
        .select()
        .from(organizationInvitations)
        .where(eq(organizationInvitations.tokenHash, tokenHash))
        .limit(1);
      return row ? mapInvitation(row) : null;
    },
    async consumeInvitation({ tokenHash, email, userId, now }) {
      return db.transaction(async (transaction) => {
        const [invitationRow] = await transaction
          .select()
          .from(organizationInvitations)
          .where(eq(organizationInvitations.tokenHash, tokenHash))
          .for("update")
          .limit(1);
        const invitation = invitationRow ? mapInvitation(invitationRow) : null;
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
        const existing = await transaction
          .select()
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.companyId, invitation.companyId),
              eq(organizationMemberships.userId, userId),
            ),
          )
          .limit(1);
        const [membershipRow] = existing.length
          ? await transaction
              .update(organizationMemberships)
              .set({ role: invitation.role, status: "active", updatedAt: new Date(now) })
              .where(
                and(
                  eq(organizationMemberships.companyId, invitation.companyId),
                  eq(organizationMemberships.userId, userId),
                ),
              )
              .returning()
          : await transaction
              .insert(organizationMemberships)
              .values({
                companyId: invitation.companyId,
                userId,
                role: invitation.role,
                status: "active",
                createdBy: invitation.invitedBy,
                createdAt: new Date(now),
                updatedAt: new Date(now),
              })
              .returning();
        await transaction
          .update(organizationInvitations)
          .set({ acceptedAt: new Date(now) })
          .where(eq(organizationInvitations.id, invitation.id));
        return mapMembership(membershipRow);
      });
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

import type {
  OrganizationMembershipStatus,
  OrganizationRole,
} from "@/db/schema/organization_memberships";

export interface OrganizationMembership {
  companyId: string;
  userId: string;
  role: OrganizationRole;
  status: OrganizationMembershipStatus;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSummary {
  companyId: string;
  name: string;
  slug: string;
  role: OrganizationMembership["role"];
  status: OrganizationMembership["status"];
}

export interface OrganizationInvitation {
  id: string;
  companyId: string;
  email: string;
  role: OrganizationRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface CreateInvitationInput {
  companyId: string;
  invitedBy: string;
  email: string;
  role: OrganizationRole;
  expiresAt?: string;
}

export interface OrganizationStore {
  getMembership(
    companyId: string,
    userId: string,
  ): Promise<OrganizationMembership | null>;
  listMemberships(companyId: string): Promise<OrganizationMembership[]>;
  listOrganizationsForUser(userId: string): Promise<OrganizationSummary[]>;
  createMembership(input: OrganizationMembership): Promise<OrganizationMembership>;
  updateMembership(
    companyId: string,
    userId: string,
    patch: Partial<OrganizationMembership>,
  ): Promise<OrganizationMembership | null>;
  createInvitation(
    input: OrganizationInvitation,
  ): Promise<OrganizationInvitation>;
  listInvitations(companyId: string): Promise<OrganizationInvitation[]>;
  getInvitationByTokenHash(tokenHash: string): Promise<OrganizationInvitation | null>;
  consumeInvitation(input: {
    tokenHash: string;
    email: string;
    userId: string;
    now: string;
  }): Promise<OrganizationMembership>;
  updateInvitation(
    id: string,
    patch: Partial<OrganizationInvitation>,
  ): Promise<OrganizationInvitation | null>;
}

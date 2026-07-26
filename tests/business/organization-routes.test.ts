import assert from "node:assert/strict";
import test from "node:test";

import { POST as switchOrganization } from "../../src/app/api/organizations/switch/route";
import { GET as listMembers, PATCH as updateMember } from "../../src/app/api/organizations/members/route";
import {
  DELETE as revokeInvitation,
  GET as listInvitations,
} from "../../src/app/api/organizations/invitations/route";
import { POST as createOrganizationInvitation } from "../../src/app/api/organizations/invitations/route";
import { businessRequest } from "../helpers/business-context";
import { memoryOrganizationStore } from "../../src/lib/organizations/memory";
import { DEMO_COMPANY_ID, DEMO_USER_ID } from "../../src/lib/business/runtime";

test("switch organization requires a UUID target", async () => {
  const response = await switchOrganization(
    businessRequest("http://localhost/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "VALIDATION_ERROR");
});

test("organization members can be listed", async () => {
  const response = await listMembers(
    businessRequest("http://localhost/api/organizations/members"),
  );

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.members[0].userId, DEMO_USER_ID);
  assert.equal(data.members[0].role, "owner");
});

test("the last owner cannot be suspended", async () => {
  const response = await updateMember(
    businessRequest("http://localhost/api/organizations/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: DEMO_USER_ID, status: "suspended" }),
    }),
  );

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "LAST_OWNER_REQUIRED");
});

test("non-owner cannot invite another owner", async () => {
  const userId = "00000000-0000-4000-8000-000000000003";
  await memoryOrganizationStore.createMembership({
    companyId: DEMO_COMPANY_ID,
    userId,
    role: "admin",
    status: "active",
    createdBy: DEMO_USER_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const response = await createOrganizationInvitation(
    businessRequest(
      "http://localhost/api/organizations/invitations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com", role: "owner" }),
      },
      { userId, companyId: DEMO_COMPANY_ID, role: "admin" },
    ),
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "ROLE_REQUIRED");
});

test("invitations can be listed and revoked", async () => {
  const created = await createOrganizationInvitation(
    businessRequest("http://localhost/api/organizations/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pending@example.com", role: "member" }),
    }),
  );
  assert.equal(created.status, 200);
  const invitation = (await created.json()).invitation;

  const listed = await listInvitations(
    businessRequest("http://localhost/api/organizations/invitations"),
  );
  assert.equal(listed.status, 200);
  assert.ok((await listed.json()).invitations.some((item: { id: string }) => item.id === invitation.id));

  const revoked = await revokeInvitation(
    businessRequest(
      `http://localhost/api/organizations/invitations?id=${invitation.id}`,
      { method: "DELETE" },
    ),
  );
  assert.equal(revoked.status, 200);
  assert.ok((await revoked.json()).invitation.revokedAt);
});

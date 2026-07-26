import assert from "node:assert/strict";
import test from "node:test";

import { BusinessError } from "../../src/lib/business/errors";
import {
  acceptInvitation,
  createInvitation,
} from "../../src/lib/organizations/service";
import { createMemoryOrganizationStore } from "../../src/lib/organizations/memory";

const COMPANY_ID = "10000000-0000-4000-8000-000000000001";
const OWNER_ID = "10000000-0000-4000-8000-000000000002";

test("an invitation token is accepted once and then rejected", async () => {
  const store = createMemoryOrganizationStore();
  const invitation = await createInvitation(store, {
    companyId: COMPANY_ID,
    invitedBy: OWNER_ID,
    email: "member@example.com",
    role: "member",
  });

  const accepted = await acceptInvitation(
    store,
    invitation.rawToken,
    "member@example.com",
    "20000000-0000-4000-8000-000000000001",
  );
  assert.equal(accepted.membership.role, "member");

  await assert.rejects(
    acceptInvitation(
      store,
      invitation.rawToken,
      "member@example.com",
      "20000000-0000-4000-8000-000000000001",
    ),
    (error: unknown) =>
      error instanceof BusinessError && error.code === "INVITATION_CONSUMED",
  );
});

test("an invitation email must match the invited address", async () => {
  const store = createMemoryOrganizationStore();
  const invitation = await createInvitation(store, {
    companyId: COMPANY_ID,
    invitedBy: OWNER_ID,
    email: "member@example.com",
    role: "member",
  });

  await assert.rejects(
    acceptInvitation(
      store,
      invitation.rawToken,
      "other@example.com",
      "20000000-0000-4000-8000-000000000002",
    ),
    (error: unknown) =>
      error instanceof BusinessError && error.code === "INVITATION_EMAIL_MISMATCH",
  );
});

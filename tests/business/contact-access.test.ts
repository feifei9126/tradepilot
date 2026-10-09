import assert from "node:assert/strict";
import test from "node:test";
import { CrmError } from "../../src/lib/crm-repository";
import { resolveContactAccess } from "../../src/lib/contact-access";

const member = { companyId: "company", userId: "member-a", role: "member", teamId: "sales-east" };

 test("new member contacts default to their own team and cannot broaden scope", async () => {
  const access = await resolveContactAccess({ workspace: member, body: {}, create: true });
  assert.deepEqual(access, { ownerUserId: "member-a", visibility: "team", teamId: "sales-east" });
  await assert.rejects(
    resolveContactAccess({ workspace: member, body: { visibility: "workspace" }, create: true }),
    (error: unknown) => error instanceof CrmError && error.status === 403,
  );
});

test("member cannot change another owner's ACL or widen a private contact", async () => {
  await assert.rejects(
    resolveContactAccess({ workspace: member, body: { visibility: "private" }, existing: { id: "c1", name: "Customer", createdAt: "2026-10-07", ownerUserId: "member-b", visibility: "team", teamId: "sales-east" } }),
    (error: unknown) => error instanceof CrmError && error.status === 403,
  );
  await assert.rejects(
    resolveContactAccess({ workspace: member, body: { visibility: "team" }, existing: { id: "c2", name: "Customer", createdAt: "2026-10-07", ownerUserId: "member-a", visibility: "private" } }),
    (error: unknown) => error instanceof CrmError && error.status === 403,
  );
});

test("legacy contact edit with no ACL request does not require a database owner lookup", async () => {
  const result = await resolveContactAccess({ workspace: member, body: {}, existing: { id: "legacy", name: "Legacy", createdAt: "2026-10-07" } });
  assert.deepEqual(result, { ownerUserId: "member-a", visibility: "workspace", teamId: "sales-east" });
  // The contact update route deliberately does not apply this result unless an
  // ACL field was explicitly requested, preserving the legacy record's scope.
});

import { NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { requireOrganizationPermission } from "@/lib/organizations/access";
import {
  createInvitation,
  revokeOrganizationInvitation,
} from "@/lib/organizations/service";
import { getOrganizationStore } from "@/lib/organizations/runtime";

export async function POST(request: Request) {
  try {
    const context = requireBusinessContext(request);
    const store = await getOrganizationStore();
    const membership = await store.getMembership(context.companyId, context.userId);
    if (!membership) {
      throw new Error("membership lookup returned no row");
    }
    requireOrganizationPermission(membership, "members:manage-member");
    const body = (await request.json()) as { email?: unknown; role?: unknown };
    if (body.role === "owner" && membership.role !== "owner") {
      throw new BusinessError(
        "ROLE_REQUIRED",
        "Only organization owners can invite another owner",
        403,
      );
    }
    const result = await createInvitation(store, {
      companyId: context.companyId,
      invitedBy: context.userId,
      email: typeof body.email === "string" ? body.email : "",
      role: body.role === "admin" || body.role === "viewer" || body.role === "owner"
        ? body.role
        : "member",
    });
    return NextResponse.json({ ok: true, invitation: result.invitation, rawToken: result.rawToken });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const context = requireBusinessContext(request);
    const store = await getOrganizationStore();
    const membership = await store.getMembership(context.companyId, context.userId);
    if (!membership || membership.status !== "active") {
      throw new BusinessError("MEMBERSHIP_REQUIRED", "Active organization membership is required", 403);
    }
    return NextResponse.json({ invitations: await store.listInvitations(context.companyId) });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = requireBusinessContext(request);
    const id = new URL(request.url).searchParams.get("id")?.trim() || "";
    if (!id) throw new BusinessError("VALIDATION_ERROR", "Invitation id is required", 400);
    const invitation = await revokeOrganizationInvitation(
      await getOrganizationStore(),
      { companyId: context.companyId, actorUserId: context.userId, invitationId: id },
    );
    return NextResponse.json({ ok: true, invitation });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

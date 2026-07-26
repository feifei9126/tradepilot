import { NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { getOrganizationStore } from "@/lib/organizations/runtime";
import { updateOrganizationMember } from "@/lib/organizations/service";

export async function GET(request: Request) {
  try {
    const context = requireBusinessContext(request);
    const store = await getOrganizationStore();
    const actor = await store.getMembership(context.companyId, context.userId);
    if (!actor || actor.status !== "active") {
      return NextResponse.json(
        { error: "Active organization membership is required", code: "MEMBERSHIP_REQUIRED" },
        { status: 403 },
      );
    }
    return NextResponse.json({ members: await store.listMemberships(context.companyId) });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = requireBusinessContext(request);
    const body = (await request.json()) as {
      userId?: unknown;
      role?: unknown;
      status?: unknown;
    };
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId || (body.role === undefined && body.status === undefined)) {
      return NextResponse.json(
        { error: "Member and at least one change are required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    const updated = await updateOrganizationMember(
      await getOrganizationStore(),
      {
        companyId: context.companyId,
        actorUserId: context.userId,
        userId,
        role: typeof body.role === "string" ? body.role : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
      },
    );
    return NextResponse.json({ member: updated });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

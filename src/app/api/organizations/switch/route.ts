import { NextResponse } from "next/server";

import { unstable_update } from "@/lib/auth";
import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { getOrganizationStore } from "@/lib/organizations/runtime";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const context = requireBusinessContext(request);
    const body = (await request.json()) as { companyId?: unknown };
    const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
    if (!UUID_PATTERN.test(companyId)) {
      throw new BusinessError("VALIDATION_ERROR", "Target organization is invalid", 400);
    }
    const membership = await (await getOrganizationStore()).getMembership(
      companyId,
      context.userId,
    );
    if (!membership || membership.status !== "active") {
      throw new BusinessError(
        "MEMBERSHIP_REQUIRED",
        "Active organization membership is required",
        403,
      );
    }
    await unstable_update({ user: { companyId, role: membership.role } });
    return NextResponse.json({ ok: true, companyId, role: membership.role });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

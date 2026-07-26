import { NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { acceptInvitation } from "@/lib/organizations/service";
import { getOrganizationStore } from "@/lib/organizations/runtime";

export async function POST(request: Request) {
  try {
    const context = requireBusinessContext(request);
    const body = (await request.json()) as { token?: unknown; email?: unknown };
    const token = typeof body.token === "string" ? body.token : "";
    const email = typeof body.email === "string" ? body.email : "";
    const result = await acceptInvitation(
      await getOrganizationStore(),
      token,
      email || "",
      context.userId,
    );
    return NextResponse.json({ ok: true, membership: result.membership });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

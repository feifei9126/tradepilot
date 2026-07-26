import { NextRequest, NextResponse } from "next/server";
import { buildDashboard } from "@/lib/dashboard";
import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";

export async function GET(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    return NextResponse.json(buildDashboard(await repository.dashboard.snapshot()));
  } catch (error) {
    return businessErrorResponse(error);
  }
}

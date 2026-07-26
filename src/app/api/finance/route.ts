import { NextRequest, NextResponse } from "next/server";
import { buildFinanceData } from "@/lib/finance";
import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";

export async function GET(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const snapshot = await repository.dashboard.snapshot();
    return NextResponse.json(
      buildFinanceData(snapshot.orders, snapshot.quotations),
    );
  } catch (error) {
    return businessErrorResponse(error);
  }
}

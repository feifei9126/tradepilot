import { NextResponse } from "next/server";
import { getUsageSummary } from "@/lib/llm-gateway/usage";

export async function GET() {
  return NextResponse.json(getUsageSummary());
}

import { NextResponse } from "next/server";
import { getVideoEngineHealth } from "@/lib/product-video/engine";

export async function GET() {
  return NextResponse.json({ engines: await getVideoEngineHealth() });
}

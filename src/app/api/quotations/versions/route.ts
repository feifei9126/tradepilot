import { NextRequest, NextResponse } from "next/server";
let quoteVersions: Record<string, any[]> = {};
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  return NextResponse.json(quoteVersions[id || ""] || []);
}
export async function POST(req: NextRequest) {
  const { quotationId, data } = await req.json();
  if (!quoteVersions[quotationId]) quoteVersions[quotationId] = [];
  const version = { version: quoteVersions[quotationId].length + 1, data, createdAt: new Date().toISOString() };
  quoteVersions[quotationId].push(version);
  return NextResponse.json(version);
}

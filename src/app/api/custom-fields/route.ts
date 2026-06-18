import { NextRequest, NextResponse } from "next/server";
import { getSchema, getAllSchemas, updateSchema, getWorkflow, updateWorkflow } from "@/lib/custom-fields/store";
import type { EntityType } from "@/lib/custom-fields/schema";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  if (entity && ["contact","order","product","quotation","shipment","invoice","supplier"].includes(entity)) {
    return NextResponse.json(getSchema(entity as EntityType));
  }
  if (entity === "workflow") {
    return NextResponse.json(getWorkflow());
  }
  return NextResponse.json(getAllSchemas());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body._type === "workflow") {
    return NextResponse.json(updateWorkflow(body.data));
  }
  if (body.entityType) {
    return NextResponse.json(updateSchema(body.entityType, body));
  }
  return NextResponse.json({ error: "缺少 entityType" }, { status: 400 });
}

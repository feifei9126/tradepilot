import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { getTenantDiscoverySettings, saveTenantDiscoverySettings } from "@/lib/tenant-discovery";
import { boundedJson } from "@/lib/request-json";
import { ProspectingError } from "@/lib/prospecting";

async function handleGET() { return NextResponse.json({ ...await getTenantDiscoverySettings(currentWorkspace()!.companyId), canManage:["owner","admin"].includes(currentWorkspace()!.role) }); }
async function handlePOST(request: Request) {
  const workspace = currentWorkspace()!;
  try { return NextResponse.json(await saveTenantDiscoverySettings(workspace.companyId,workspace.userId,await boundedJson(request,12_000))); }
  catch (error) { if (error instanceof ProspectingError) return NextResponse.json({ error:error.message },{ status:error.status }); throw error; }
}
export const GET = withTenant(handleGET);
export const POST = withTenant(handlePOST);

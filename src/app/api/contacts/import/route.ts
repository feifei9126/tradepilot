import { importContacts } from "@/lib/ai/import-contacts";
import { withTenant } from "@/lib/tenant-route";
import type { NextRequest } from "next/server";
export const POST = withTenant(async (request: NextRequest) => importContacts(request));

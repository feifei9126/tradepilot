import { importContacts } from "@/lib/ai/import-contacts";
import type { NextRequest } from "next/server";
export async function POST(request: NextRequest) { return importContacts(request); }

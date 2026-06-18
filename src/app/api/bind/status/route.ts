import { NextResponse } from "next/server";
import { store } from "@/lib/store";
export async function GET() { return NextResponse.json({ bindings: store.bindings.getAll() }); }

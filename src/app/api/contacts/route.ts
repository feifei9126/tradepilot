import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { triggerHook } from "@/plugins/index";

export async function GET() {
  return NextResponse.json(store.contacts.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const contact = {
    id: `c${Date.now()}`,
    name: body.name,
    country: body.country || "",
    source: body.source || "manual",
    tags: body.tags || [],
    notes: body.notes || "",
    email: body.email || "",
    phone: body.phone || "",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.contacts.add(contact);
  await triggerHook("contact.afterCreate", contact);
  return NextResponse.json(contact, { status: 201 });
}

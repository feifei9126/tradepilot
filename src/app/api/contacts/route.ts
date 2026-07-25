import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import { isValidEmail } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(store.contacts.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name)
    return NextResponse.json({ error: "客户名称必填" }, { status: 400 });
  if (name.length > 200)
    return NextResponse.json({ error: "客户名称过长" }, { status: 400 });
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "客户邮箱格式无效" }, { status: 400 });
  }
  const contact = {
    id: `c_${randomUUID()}`,
    name,
    country:
      typeof body.country === "string" ? body.country.trim().slice(0, 100) : "",
    source:
      typeof body.source === "string"
        ? body.source.trim().slice(0, 100)
        : "manual",
    tags: Array.isArray(body.tags)
      ? body.tags
          .filter((tag: unknown): tag is string => typeof tag === "string")
          .map((tag: string) => tag.trim())
          .filter(Boolean)
          .slice(0, 20)
      : [],
    notes:
      typeof body.notes === "string" ? body.notes.trim().slice(0, 10_000) : "",
    email,
    phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 80) : "",
    grade: ["A", "B", "C"].includes(body.grade) ? body.grade : undefined,
    stage: ["new", "following", "negotiating", "converted", "lost"].includes(
      body.stage,
    )
      ? body.stage
      : "new",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.contacts.add(contact);
  return NextResponse.json(contact, { status: 201 });
}

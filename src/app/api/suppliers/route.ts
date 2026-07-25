import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import { isValidEmail } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(store.suppliers.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name)
    return NextResponse.json({ error: "供应商名称必填" }, { status: 400 });
  if (name.length > 200)
    return NextResponse.json({ error: "供应商名称过长" }, { status: 400 });
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "供应商邮箱格式无效" }, { status: 400 });
  }
  const rating = Number(body.rating);
  const supplier = {
    id: `s_${randomUUID()}`,
    name,
    contactName:
      typeof body.contactName === "string"
        ? body.contactName.trim().slice(0, 200)
        : "",
    phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 80) : "",
    email,
    country:
      typeof body.country === "string" ? body.country.trim().slice(0, 100) : "",
    products: Array.isArray(body.products)
      ? body.products
          .filter((item: unknown): item is string => typeof item === "string")
          .map((item: string) => item.trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 100)
      : [],
    rating:
      Number.isInteger(rating) && rating >= 1 && rating <= 5
        ? rating
        : undefined,
    tags: Array.isArray(body.tags)
      ? body.tags
          .filter((item: unknown): item is string => typeof item === "string")
          .map((item: string) => item.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 30)
      : [],
    createdAt: new Date().toISOString().slice(0, 10),
  };
  store.suppliers.add(supplier);
  return NextResponse.json(supplier, { status: 201 });
}

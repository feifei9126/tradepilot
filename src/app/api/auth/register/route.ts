import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company, name, email, password } = body;

    if (!company || !name || !email || !password) {
      return NextResponse.json(
        { error: "\u6240\u6709\u5b57\u6bb5\u90fd\u662f\u5fc5\u586b\u7684" },
        { status: 400 }
      );
    }

    const existing = store.users.findByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "\u8be5\u90ae\u7bb1\u5df2\u88ab\u6ce8\u518c" },
        { status: 409 }
      );
    }

    const companyId = crypto.randomUUID();
    const companySlug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    store.companies.create({
      id: companyId,
      name: company,
      slug: companySlug,
      createdAt: new Date().toISOString(),
    });

    const userId = crypto.randomUUID();
    store.users.create({
      id: userId,
      companyId,
      email,
      name,
      password,
      role: "owner",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      user: { id: userId, email, name, companyId, role: "owner" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "\u6ce8\u518c\u5931\u8d25" },
      { status: 500 }
    );
  }
}

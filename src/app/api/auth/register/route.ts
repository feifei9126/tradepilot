import { NextResponse } from "next/server";
import { createUser } from "@/lib/registration";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company, name, email, password } = body;

    if (!company || !name || !email || !password) {
      return NextResponse.json(
        { error: "所有字段都是必填的" },
        { status: 400 }
      );
    }

    const result = await createUser(company, name, email, password);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "注册失败" },
        { status: result.error === "该邮箱已被注册" ? 409 : 400 }
      );
    }

    return NextResponse.json({ ok: true, user: result.user });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "注册失败" },
      { status: 500 }
    );
  }
}

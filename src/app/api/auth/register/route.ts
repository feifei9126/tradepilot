import { NextResponse } from "next/server";

import { createUser } from "@/lib/registration";

export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.DATABASE_URL) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const company = typeof body.company === "string" ? body.company : "";
    const name = typeof body.name === "string" ? body.name : "";
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!company || !name || !email || !password) {
      return NextResponse.json(
        { error: "所有字段都是必填的" },
        { status: 400 },
      );
    }

    const result = await createUser(company, name, email, password);
    if (!result.ok) {
      const status =
        result.error === "该邮箱已被注册"
          ? 409
          : result.error === "数据库未配置，暂时无法注册"
            ? 503
            : 400;
      return NextResponse.json(
        { error: result.error || "注册失败" },
        { status },
      );
    }

    return NextResponse.json({ ok: true, user: result.user });
  } catch {
    return NextResponse.json({ error: "注册请求格式无效" }, { status: 400 });
  }
}

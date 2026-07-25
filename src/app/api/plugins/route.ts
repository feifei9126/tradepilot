import { NextResponse } from "next/server";

import { isValidPluginName } from "@/lib/plugin-name";

export async function GET() {
  return NextResponse.json({
    plugins: [],
    warnings: [
      "插件通过源码目录管理；Cloudflare 与容器部署均不执行运行时插件代码。",
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!isValidPluginName(name)) {
      return NextResponse.json(
        { error: "插件名只能包含小写字母、数字和连字符" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          "运行时创建插件已禁用。请在源码目录运行 scripts/create-plugin.sh 后重新部署。",
      },
      { status: 501 },
    );
  } catch {
    return NextResponse.json({ error: "插件请求格式无效" }, { status: 400 });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "插件卸载需要修改源码并重新部署" },
    { status: 501 },
  );
}

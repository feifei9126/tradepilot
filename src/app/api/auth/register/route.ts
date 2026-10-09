import { NextResponse } from "next/server";

/** Self-service workspace registration stays closed until every business
 * resource has database persistence and verified tenant isolation. */
export async function GET() {
  return NextResponse.json({
    enabled: false,
    reason: "当前版本暂不开放自助注册。请由工作区所有者在成员管理中添加成员。",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  return NextResponse.json(
    { error: "自助注册暂未开放；请联系工作区所有者添加账号。" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

import { auth } from "@/lib/auth";
import { readDatabaseStatus } from "@/lib/database-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
  if (session.user.isPlatformAdmin !== true || session.user.mustChangePassword) return Response.json({ error: "仅平台管理员可以查看数据库状态" }, { status: 403, headers });
  return Response.json(await readDatabaseStatus(), { headers });
}

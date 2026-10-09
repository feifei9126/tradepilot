import { z } from "zod";
import { resetMemberSchema } from "@/lib/management-schema";
import { auth } from "@/lib/auth";
import { boundedJson, mutationOrigin, RequestBodyError } from "@/lib/api-config/access";
import { resetWorkspaceMemberPassword, TeamError } from "@/lib/team";
import { DatabaseUnavailableError } from "@/db";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private" };
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.databaseUnavailable) return Response.json({ error: "数据库暂时不可用，请稍后重试" }, { status: 503, headers });
  if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
  const denied = mutationOrigin(request);
  if (denied) return denied;
  try {
    const { id } = resetMemberSchema.parse(await boundedJson(request));
    return Response.json(await resetWorkspaceMemberPassword({ ...session.user, id: session.user.id }, id), { headers });
  } catch (error) {
    if (error instanceof RequestBodyError || error instanceof TeamError || error instanceof DatabaseUnavailableError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "重置密码失败，请检查输入或稍后再试" }, { status: error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503, headers });
  }
}

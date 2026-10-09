import { DatabaseUnavailableError } from "@/db";
import { z } from "zod";
import { createMemberSchema, updateMemberSchema } from "@/lib/management-schema";

import { auth } from "@/lib/auth";
import { boundedJson, mutationOrigin, RequestBodyError } from "@/lib/api-config/access";
import { createWorkspaceMember, listWorkspaceMembers, TeamError, updateWorkspaceMember } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
function failure(error: unknown) {
  if (error instanceof RequestBodyError || error instanceof TeamError || error instanceof DatabaseUnavailableError) return Response.json({ error: error.message }, { status: error.status, headers });
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "成员信息格式不正确" }, { status: 400, headers });
  if (error instanceof SyntaxError) return Response.json({ error: "JSON 格式不正确" }, { status: 400, headers });
  console.error("Workspace member operation failed");
  return Response.json({ error: "成员管理暂时不可用" }, { status: 503, headers });
}

export async function GET() {
  const session = await auth();
  if (session?.user?.databaseUnavailable) return Response.json({ error: "数据库暂时不可用，请稍后重试" }, { status: 503, headers });
  if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
  try {
    return Response.json(await listWorkspaceMembers({ id: session.user.id, companyId: session.user.companyId, role: session.user.role, isPlatformAdmin: session.user.isPlatformAdmin === true, mustChangePassword: session.user.mustChangePassword === true }), { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.databaseUnavailable) return Response.json({ error: "数据库暂时不可用，请稍后重试" }, { status: 503, headers });
  if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
  const denied = mutationOrigin(request);
  if (denied) return denied;
  try {
    const input = createMemberSchema.parse(await boundedJson(request));
    return Response.json(await createWorkspaceMember({ id: session.user.id, companyId: session.user.companyId, role: session.user.role, isPlatformAdmin: session.user.isPlatformAdmin === true, mustChangePassword: session.user.mustChangePassword === true }, input), { status: 201, headers });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (session?.user?.databaseUnavailable) return Response.json({ error: "数据库暂时不可用，请稍后重试" }, { status: 503, headers });
  if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
  const denied = mutationOrigin(request);
  if (denied) return denied;
  try {
    const input = updateMemberSchema.parse(await boundedJson(request));
    return Response.json(await updateWorkspaceMember({ id: session.user.id, companyId: session.user.companyId, role: session.user.role, isPlatformAdmin: session.user.isPlatformAdmin === true, mustChangePassword: session.user.mustChangePassword === true }, input), { headers });
  } catch (error) { return failure(error); }
}

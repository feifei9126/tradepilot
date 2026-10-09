import { z } from "zod";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@/lib/management-schema";
import { auth } from "@/lib/auth";
import { boundedJson, mutationOrigin, RequestBodyError } from "@/lib/api-config/access";
import { createSaasWorkspace, listSaasWorkspaces, updateSaasWorkspace } from "@/lib/saas";
import { TeamError } from "@/lib/team";
import { DatabaseUnavailableError } from "@/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
function failure(error: unknown) {
  if (error instanceof RequestBodyError || error instanceof TeamError || error instanceof DatabaseUnavailableError) return Response.json({ error: error.message }, { status: error.status, headers });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : "JSON 格式不正确" }, { status: 400, headers });
  return Response.json({ error: "SaaS 管理暂时不可用" }, { status: 503, headers });
}
async function handle(request?: Request, method = "GET") {
  const session = await auth();
  if (session?.user?.databaseUnavailable) return Response.json({ error: "数据库暂时不可用，请稍后重试" }, { status: 503, headers });
  if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
  if (session.user.isPlatformAdmin !== true || session.user.mustChangePassword) return Response.json({ error: "仅平台管理员可以管理工作区" }, { status: 403, headers });
  if (request && method !== "GET") { const denied = mutationOrigin(request); if (denied) return denied; }
  try {
    const actor = { ...session.user, id: session.user.id };
    if (method === "GET") return Response.json(await listSaasWorkspaces(actor), { headers });
    const body = await boundedJson(request!);
    if (method === "POST") return Response.json(await createSaasWorkspace(actor, createWorkspaceSchema.parse(body)), { status: 201, headers });
    return Response.json(await updateSaasWorkspace(actor, updateWorkspaceSchema.parse(body)), { headers });
  } catch (error) { return failure(error); }
}
export const GET = () => handle();
export const POST = (request: Request) => handle(request, "POST");
export const PATCH = (request: Request) => handle(request, "PATCH");

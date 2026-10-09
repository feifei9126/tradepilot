import { z } from "zod";
import { auth } from "@/lib/auth";
import { AccountError, getAccountProfile, updateAccountProfile } from "@/lib/account";
import { boundedJson, mutationOrigin, RequestBodyError } from "@/lib/api-config/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const inputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  locale: z.enum(["zh", "en"]),
  timezone: z.string().min(1).max(64).refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "无效的时区"),
}).strict();

function failure(error: unknown) {
  if (error instanceof RequestBodyError || error instanceof AccountError) return Response.json({ error: error.message }, { status: error.status, headers });
  if (error instanceof z.ZodError) return Response.json({ error: "个人设置格式不正确" }, { status: 400, headers });
  if (error instanceof SyntaxError) return Response.json({ error: "JSON 格式不正确" }, { status: 400, headers });
  console.error("Account profile error:", error);
  return Response.json({ error: "个人设置暂时不可用" }, { status: 503, headers });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
  try { return Response.json(await getAccountProfile(session.user.id), { headers }); }
  catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
  const denied = mutationOrigin(request);
  if (denied) return denied;
  try {
    const input = inputSchema.parse(await boundedJson(request));
    return Response.json(await updateAccountProfile(session.user.id, input), { headers });
  } catch (error) { return failure(error); }
}

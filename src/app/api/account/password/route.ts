import { z } from "zod";
import { auth } from "@/lib/auth";
import { AccountError, changeAccountPassword } from "@/lib/account";
import { boundedJson, mutationOrigin, RequestBodyError } from "@/lib/api-config/access";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private" };
const inputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).strict().refine((input) => input.newPassword === input.confirmPassword, "两次输入的新密码不一致");

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
  const denied = mutationOrigin(request);
  if (denied) return denied;
  try {
    const input = inputSchema.parse(await boundedJson(request));
    await changeAccountPassword(session.user.id, input.currentPassword, input.newPassword);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof RequestBodyError || error instanceof AccountError) return Response.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "密码格式不正确" }, { status: 400, headers });
    if (error instanceof SyntaxError) return Response.json({ error: "JSON 格式不正确" }, { status: 400, headers });
    console.error("Password change error:", error);
    return Response.json({ error: "修改密码失败，请稍后再试" }, { status: 503, headers });
  }
}

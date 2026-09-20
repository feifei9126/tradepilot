import { auth } from "@/lib/auth";
export async function configAccess(adminOnly = false) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "请先登录" }, { status: 401 });
  if (
    session.user.companyId !== "deployment-workspace" ||
    (adminOnly && session.user.id !== "deployment-admin")
  )
    return Response.json(
      { error: "仅部署管理员可管理本实例 API；其他工作区不能使用此配置" },
      { status: 403 },
    );
  return null;
}
export function mutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.AUTH_URL || request.url).origin)
    return Response.json(
      { error: "不允许跨站修改或测试 API 配置" },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "需要 JSON 请求" }, { status: 415 });
  return null;
}
export async function boundedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("请求为空");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64000) {
        await reader.cancel();
        throw new Error("请求过大");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

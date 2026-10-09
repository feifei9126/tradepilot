import { auth } from "@/lib/auth";
export async function configAccess(adminOnly = false) {
  const session = await auth();
  if (session?.user?.databaseUnavailable) return Response.json({ error: "数据库暂时不可用" }, { status: 503 });
  if (!session?.user?.id)
    return Response.json({ error: "请先登录" }, { status: 401 });
  if (session.user.mustChangePassword) return Response.json({ error: "请先修改临时密码" }, { status: 403 });
  // Instance credentials belong to the platform, never a client-supplied
  // workspace ID or a particular technical user ID.
  if (session.user.isPlatformAdmin !== true) return Response.json(
    { error: adminOnly ? "仅平台管理员可管理本实例 API" : "此实例服务尚未开放给普通租户" },
    { status: 403 },
  );
  return null;
}
export function mutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.AUTH_URL || request.url).origin)
    return Response.json(
      { error: "不允许跨站提交请求" },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "需要 JSON 请求" }, { status: 415 });
  return null;
}
export { boundedJson, RequestBodyError } from "@/lib/request-json";

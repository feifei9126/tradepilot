import { currentWorkspace } from "./workspace-context";
import { CrmError } from "./crm-repository";
import { RequestBodyError } from "./request-json";
import { ProspectingError } from "./prospecting";
import { auth } from "@/lib/auth";

export function withPlatform<T extends (...args: never[]) => Promise<Response>>(handler: T): (...args: Parameters<T>) => Promise<Response> {
  return async (...args) => {
    const headers = { "Cache-Control": "no-store, private" };
    try {
      // ALS is set only by server-side authentication, never by client fields.
      const workspace = currentWorkspace();
      if (workspace) {
        if (!workspace.isPlatformAdmin) return Response.json({ error: "仅平台管理员可以访问本实例功能" }, { status: 403, headers });
        const response = await handler(...args);
        response.headers.set("Cache-Control", "no-store, private");
        return response;
      }
      const session = await auth();
      if (session?.user?.databaseUnavailable) return Response.json({ error: "数据库暂不可用" }, { status: 503, headers });
      if (!session?.user?.id) return Response.json({ error: "请先登录" }, { status: 401, headers });
      if (session.user.isPlatformAdmin !== true || session.user.mustChangePassword) return Response.json({ error: "仅平台管理员可以访问本实例诊断信息" }, { status: 403, headers });
      const response = await handler(...args);
      response.headers.set("Cache-Control", "no-store, private");
      return response;
    } catch (error) {
      if (error instanceof CrmError || error instanceof RequestBodyError || error instanceof ProspectingError) return Response.json({ error: error.message }, { status: error.status, headers });
      return Response.json({ error: "诊断服务暂时不可用" }, { status: 503, headers });
    }
  };
}

import { BusinessError } from "./errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BusinessContext {
  userId: string;
  companyId: string;
  role: string;
}

export function injectBusinessContextHeaders(
  source: Headers,
  context: BusinessContext,
) {
  const headers = new Headers(source);
  headers.delete("x-tradepilot-user-id");
  headers.delete("x-tradepilot-company-id");
  headers.delete("x-tradepilot-role");
  headers.set("x-tradepilot-user-id", context.userId);
  headers.set("x-tradepilot-company-id", context.companyId);
  headers.set("x-tradepilot-role", context.role);
  return headers;
}

export function requireBusinessContext(request: { headers: Headers }) {
  const userId = request.headers.get("x-tradepilot-user-id")?.trim() || "";
  const companyId =
    request.headers.get("x-tradepilot-company-id")?.trim() || "";
  const role = request.headers.get("x-tradepilot-role")?.trim() || "member";

  if (!userId && !companyId) {
    throw new BusinessError("UNAUTHORIZED", "请先登录", 401);
  }
  if (!UUID_PATTERN.test(userId) || !UUID_PATTERN.test(companyId)) {
    throw new BusinessError(
      "TENANT_CONTEXT_INVALID",
      "当前登录会话缺少有效的工作区信息",
      403,
    );
  }

  return { userId, companyId, role } satisfies BusinessContext;
}

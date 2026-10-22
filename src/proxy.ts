import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const PUBLIC_API_PREFIXES = ["/api/auth/"];

const PUBLIC_API_PATHS = new Set([
  "/api/health/live",
  "/api/health/ready",
  // The route enforces a separate high-entropy Bearer token. Do not add
  // metrics to the unauthenticated health-check paths above.
  "/api/metrics",
  "/api/bind/confirm",
  "/api/webhook/incoming",
  "/api/billing/webhook",
  "/api/email/unsubscribe",
  "/api/email/subscribe",
]);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  if (
    /^\/api\/channels\/(wechat|whatsapp)\/[a-f\d-]{36}$/i.test(pathname) ||
    PUBLIC_API_PATHS.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }
  if (request.auth?.user?.databaseUnavailable) {
    const headers = { "Cache-Control": "no-store, private", "Retry-After": "30" };
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "数据库暂时不可用，请稍后重试" }, { status: 503, headers })
      : new NextResponse("数据库暂时不可用，请稍后刷新。登录会话未因本次故障被撤销。", { status: 503, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (request.auth?.user?.id) {
    // Any active workspace may use tenant-scoped business modules.  The
    // deployment workspace flag identifies the legacy instance account, not a
    // permission to access another tenant's data.  Platform-only capabilities
    // are checked separately with isPlatformAdmin below.
    const mustChangePassword = request.auth.user.mustChangePassword === true;
    const allowedDuringPasswordChange = pathname === "/app/account" || pathname === "/api/account" || pathname === "/api/account/password" || pathname.startsWith("/api/auth/");
    if (mustChangePassword && !allowedDuringPasswordChange) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "首次登录请先修改临时密码" }, { status: 403 });
      return NextResponse.redirect(new URL("/app/account?requirePasswordChange=1", request.nextUrl.origin));
    }
    const usesPlatformServices = [
      "/api/admin",
      "/api/network",
      "/api/build/status",
      "/app/saas",
      "/api/api-config",
      "/api/livekit",
      "/api/product-videos",
      "/api/firecrawl",
      "/api/products/import",
      "/app/api-config",
      "/app/database",
    ].some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
    if (usesPlatformServices && request.auth.user?.isPlatformAdmin !== true) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "仅平台管理员可以使用本实例服务" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/app?forbidden=platform-service", request.nextUrl.origin));
    }
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const loginUrl = new URL("/auth/login", request.nextUrl.origin);
  loginUrl.searchParams.set(
    "callbackUrl",
    `${pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // Auth.js routes manage their own CSRF/session cookies. Wrapping them in
  // auth() again writes a second CSRF cookie, overwriting the callback token.
  matcher: ["/app/:path*", "/api/((?!auth(?:/|$)).*)"],
};

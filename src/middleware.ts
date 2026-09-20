import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const PUBLIC_API_PREFIXES = ["/api/auth/"];

const PUBLIC_API_PATHS = new Set([
  "/api/network",
  "/api/bind/confirm",
  "/api/webhook/incoming",
  "/api/build/status",
]);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  if (
    PUBLIC_API_PATHS.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }
  if (request.auth) {
    const usesInstanceServices = ["/api/api-config", "/api/livekit", "/api/product-videos", "/api/firecrawl"].some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
    if (usesInstanceServices && request.auth.user?.companyId !== "deployment-workspace") {
      return NextResponse.json({ error: "无权使用本实例 API 配置" }, { status: 403 });
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
  matcher: ["/app/:path*", "/api/:path*"],
};

import { NextResponse } from "next/server";

import { injectBusinessContextHeaders } from "@/lib/business/context";
import { auth } from "@/lib/auth";

const PUBLIC_API_PREFIXES = ["/api/auth/"];

const PUBLIC_API_PATHS = new Set([
  "/api/network",
  "/api/bind/confirm",
  "/api/webhook/incoming",
  "/api/build/status",
  "/api/health",
]);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  if (
    PUBLIC_API_PATHS.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }
  if (request.auth?.user) {
    const headers = injectBusinessContextHeaders(request.headers, {
      userId: request.auth.user.id || "",
      companyId: request.auth.user.companyId || "",
      role: request.auth.user.role || "member",
    });
    return NextResponse.next({ request: { headers } });
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

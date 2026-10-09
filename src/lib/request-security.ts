const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Cookie-authenticated writes must not accept a cross-site browser request. */
export function crossSiteMutation(request: Request): Response | null {
  if (READ_ONLY_METHODS.has(request.method.toUpperCase())) return null;
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.AUTH_URL || request.url).origin;
  // Non-browser clients may omit Origin; browsers also provide Fetch Metadata.
  if ((origin && origin !== expected) || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "不允许跨站提交请求" }, { status: 403 });
  }
  return null;
}

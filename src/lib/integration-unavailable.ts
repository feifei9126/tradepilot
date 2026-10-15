/** Fail closed until tenant-scoped credentials, replay protection and a real
 * connector have been implemented. An instance secret is not tenant auth. */
export function integrationUnavailable(feature: string) {
  return Response.json({
    error: `${feature}尚未完成多租户安全接入，当前已关闭。不会生成令牌、登记设备或写入消息。`,
    code: "TENANT_INTEGRATION_UNAVAILABLE",
  }, { status: 503, headers: { "Cache-Control": "no-store, private" } });
}

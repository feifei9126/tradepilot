import { withTenant } from "@/lib/tenant-route";
import { boundedJson } from "@/lib/request-json";
import { channelSetup } from "@/lib/messaging/accounts";
export const runtime = "nodejs";
async function handlePOST(request: Request) {
  const body = (await boundedJson(request, 1000)) as { accountId?: unknown };
  return Response.json(
    await channelSetup(
      typeof body?.accountId === "string" ? body.accountId : "",
    ),
  );
}
export const POST = withTenant(handlePOST);

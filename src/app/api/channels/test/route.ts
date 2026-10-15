import { withTenant } from "@/lib/tenant-route";
import { getStore } from "@/lib/workspace-context";
import { boundedJson } from "@/lib/request-json";
import { takeDistributedRateLimit } from "@/lib/distributed-rate-limit";
import {
  findChannelAccount,
  requireChannelAdmin,
} from "@/lib/messaging/accounts";
import { testChannelConnection } from "@/lib/messaging/providers";
import { ChannelError } from "@/lib/messaging/types";
export const runtime = "nodejs";
async function handlePOST(request: Request) {
  requireChannelAdmin();
  const body = (await boundedJson(request, 1000)) as { accountId?: unknown };
  const account = await findChannelAccount(
    typeof body?.accountId === "string" ? body.accountId : "",
    getStore().companyId,
  );
  const limit = await takeDistributedRateLimit(
    "messaging-api-test:5/60",
    account.id,
    5,
    60,
  );
  if (!limit.allowed) throw new ChannelError("测试太频繁，请一分钟后重试", 429);
  return Response.json(await testChannelConnection(account));
}
export const POST = withTenant(handlePOST);

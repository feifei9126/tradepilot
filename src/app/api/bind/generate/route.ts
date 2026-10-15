import { withTenant } from "@/lib/tenant-route";
import { integrationUnavailable } from "@/lib/integration-unavailable";

export const POST = withTenant(async () => integrationUnavailable("消息接入登记"));

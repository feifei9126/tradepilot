import { withTenant } from "@/lib/tenant-route";
import { withPlatform } from "@/lib/platform-route";
import { previewProduct } from "@/lib/firecrawl/preview-route";

export const POST = withTenant(withPlatform(previewProduct));

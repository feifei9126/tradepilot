import { withTenant } from "@/lib/tenant-route";
import { withPlatform } from "@/lib/platform-route";
import { previewProduct } from "@/lib/firecrawl/preview-route";

// Compatibility alias has exactly the same protection as /api/firecrawl/preview.
export const POST = withTenant(withPlatform(previewProduct));

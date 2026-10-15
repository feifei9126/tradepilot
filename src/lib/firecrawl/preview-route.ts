import { NextRequest, NextResponse } from "next/server";
import { boundedJson } from "@/lib/request-json";
import { CrmError } from "@/lib/crm-repository";
import { scrapeTenantPublicPage } from "@/lib/tenant-discovery";
import { currentWorkspace } from "@/lib/workspace-context";
import { normalizeFirecrawlProduct } from "./normalize";

/** Shared by the canonical route and its compatibility alias; both are
 * platform-only, origin-checked and included in the shared expensive limiter. */
export async function previewProduct(request: NextRequest) {
  const body = await boundedJson(request,8_000);
  const url = body && typeof body === "object" && "url" in body ? body.url : undefined;
  if (typeof url !== "string" || !url.trim() || url.length > 4096) throw new CrmError("请提供有效的产品链接");
  const workspace = currentWorkspace();
  if (!workspace) throw new CrmError("请先登录工作区", 401);
  const data = await scrapeTenantPublicPage(workspace.companyId, workspace.userId, url.trim());
  const preview = normalizeFirecrawlProduct(data, url.trim());
  return NextResponse.json({ product: preview, preview, requiresConfirmation: true });
}

import { handleStripeEvent, BillingError } from "@/lib/billing";
import { boundedText, RequestBodyError } from "@/lib/request-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const payload = await boundedText(req, 1_000_000);
    const signature = req.headers.get("stripe-signature") || "";
    const result = await handleStripeEvent(payload, signature);
    return Response.json({ received: true, duplicate: result.duplicate }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    if (error instanceof BillingError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    console.error("Billing webhook failed (details omitted)");
    return Response.json({ error: "支付回调处理失败" }, { status: 503 });
  }
}

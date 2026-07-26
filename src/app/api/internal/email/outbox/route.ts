import { NextResponse } from "next/server";

import { processEmailOutbox } from "@/lib/email/outbox";
import { getPostgresEmailRepository } from "@/lib/email/runtime";
import { hasValidWebhookSecret } from "@/lib/webhook-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.TRADEPILOT_CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Email outbox schedule is not configured" }, { status: 503 });
  if (!hasValidWebhookSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await processEmailOutbox({
    repository: getPostgresEmailRepository(),
    credentialsKey: process.env.TRADEPILOT_CREDENTIALS_KEY,
    providers: ["resend"],
    limit: 50,
  });
  return NextResponse.json({ ok: true, processed: results.length, results });
}

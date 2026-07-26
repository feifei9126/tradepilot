import { NextResponse } from "next/server";

import {
  databaseHealthMessage,
  getDatabaseHealth,
} from "@/lib/database-health";

export async function GET() {
  const health = await getDatabaseHealth();
  const code =
    health.storage === "not_configured"
      ? "DATABASE_NOT_CONFIGURED"
      : health.database === "unavailable"
        ? "DATABASE_UNAVAILABLE"
        : health.migrations === "outdated" || health.bootstrapRequired
          ? "DATABASE_SCHEMA_OUTDATED"
          : undefined;
  return NextResponse.json(
    {
      ...health,
      ...(code ? { code, message: databaseHealthMessage(health) } : {}),
    },
    {
      status: health.status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

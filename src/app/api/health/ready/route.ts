import { readDatabaseStatus } from "@/lib/database-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    const status = await readDatabaseStatus();
    const ready = status.state === "ready" && status.schemaReady;
    return Response.json({ status: ready ? "ready" : "not_ready" }, {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store", ...(ready ? {} : { "Retry-After": "15" }) },
    });
  } catch {
    return Response.json({ status: "not_ready" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "15" } });
  }
}

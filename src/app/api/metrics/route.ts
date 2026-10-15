import { readDatabaseStatus } from "@/lib/database-status";
import { authorizeMetricsRequest } from "@/lib/metrics-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store, private" };
const contentType = "text/plain; version=0.0.4; charset=utf-8";

export async function GET(request: Request) {
  const authorization = authorizeMetricsRequest(request);
  if (authorization !== "authorized") {
    const status = authorization === "unconfigured" ? 503 : 401;
    return new Response("metrics endpoint unavailable\n", {
      status,
      headers: {
        ...noStore,
        "Content-Type": "text/plain; charset=utf-8",
        ...(status === 401 ? { "WWW-Authenticate": 'Bearer realm="metrics"' } : {}),
      },
    });
  }

  let databaseReady = 0;
  try {
    const database = await readDatabaseStatus();
    databaseReady = database.state === "ready" && database.schemaReady ? 1 : 0;
  } catch {
    // Keep the scrape endpoint available during a database incident.
  }

  const memory = process.memoryUsage();
  const metrics = [
    "# HELP tradepilot_application_up Application metrics endpoint is serving requests.",
    "# TYPE tradepilot_application_up gauge",
    "tradepilot_application_up 1",
    "# HELP tradepilot_database_ready Database is reachable and the current schema is ready.",
    "# TYPE tradepilot_database_ready gauge",
    `tradepilot_database_ready ${databaseReady}`,
    "# HELP tradepilot_process_uptime_seconds Process uptime in seconds.",
    "# TYPE tradepilot_process_uptime_seconds gauge",
    `tradepilot_process_uptime_seconds ${Math.floor(process.uptime())}`,
    "# HELP tradepilot_process_resident_memory_bytes Resident memory size in bytes.",
    "# TYPE tradepilot_process_resident_memory_bytes gauge",
    `tradepilot_process_resident_memory_bytes ${memory.rss}`,
    "# HELP tradepilot_process_heap_used_bytes V8 heap used in bytes.",
    "# TYPE tradepilot_process_heap_used_bytes gauge",
    `tradepilot_process_heap_used_bytes ${memory.heapUsed}`,
    "# HELP tradepilot_process_heap_total_bytes V8 heap total in bytes.",
    "# TYPE tradepilot_process_heap_total_bytes gauge",
    `tradepilot_process_heap_total_bytes ${memory.heapTotal}`,
    "",
  ];

  return new Response(metrics.join("\n"), {
    headers: { ...noStore, "Content-Type": contentType },
  });
}

import { createHash } from "node:crypto";
import { query } from "@/db";

export type RateLimitDecision = { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number };

/** Fixed-window PostgreSQL limiter. The atomic upsert is shared by all app replicas. */
export async function takeDistributedRateLimit(scope: string, identity: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
  const safeScope = scope.slice(0, 100);
  const keyHash = createHash("sha256").update(`${safeScope}\0${identity}`).digest("hex");
  const result = await query<{ hit_count: number; window_start: Date }>(`
    WITH bucket AS (
      SELECT to_timestamp(floor(extract(epoch FROM clock_timestamp()) / $3) * $3) AS starts_at
    )
    INSERT INTO rate_limit_counters(scope,key_hash,window_start,hit_count,expires_at)
    SELECT $1,$2,bucket.starts_at,1,bucket.starts_at + ($3 * interval '1 second')
    FROM bucket
    ON CONFLICT(scope,key_hash,window_start) DO UPDATE
      SET hit_count=rate_limit_counters.hit_count+1, expires_at=EXCLUDED.expires_at
    RETURNING hit_count,window_start`, [safeScope, keyHash, windowSeconds]);
  const row = result.rows[0];
  const now = Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((new Date(row.window_start).getTime() + windowSeconds * 1000 - now) / 1000));
  // Opportunistic bounded cleanup keeps the counter table from growing forever.
  if (Math.random() < 1 / 64) {
    await query(`WITH expired AS (SELECT ctid FROM rate_limit_counters WHERE expires_at < now() LIMIT 1000)
      DELETE FROM rate_limit_counters r USING expired e WHERE r.ctid=e.ctid`).catch(() => {});
  }
  return { allowed: Number(row.hit_count) <= limit, limit, remaining: Math.max(0, limit - Number(row.hit_count)), retryAfterSeconds };
}

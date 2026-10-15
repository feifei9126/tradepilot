import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { transaction } from "@/db";

/** Next's Request has no authenticated socket peer. Unknown peers share a safe
 * global bucket. A dedicated edge header is trusted only with a shared secret;
 * the ingress must remove both headers from client traffic before setting them. */
export function loginClientIdentity(request: Request): string {
  const header = process.env.TRADEPILOT_TRUSTED_CLIENT_IP_HEADER?.toLowerCase();
  const secret = process.env.TRADEPILOT_PROXY_AUTH_SECRET || "";
  const supplied = request.headers.get("x-tradepilot-proxy-auth") || "";
  if (!["x-real-ip", "cf-connecting-ip"].includes(header || "") || secret.length < 32) return "unverified-peer";
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "unverified-peer";
  const ip = request.headers.get(header!)?.trim() || "";
  if (!isIP(ip)) return "unverified-peer";
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
}

const hash = (kind: string, value: string) => createHash("sha256").update(`${kind}\0${value}`).digest("hex");
export type LoginAttempt = { allowed: boolean; keys: string[] };

/** Attempts are reserved before password hashing, atomically across replicas.
 * Denied requests never extend a lock. Windows and backoff expire naturally. */
export async function reserveLoginAttempt(email: string, request: Request): Promise<LoginAttempt> {
  const keys = [hash("ip", loginClientIdentity(request)), hash("account", email.trim().toLowerCase())];
  return transaction(async client => {
    for (const key of [...keys].sort()) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`login:${key}`]);
    let allowed = true;
    for (let i = 0; i < keys.length; i++) {
      const result = await client.query(`INSERT INTO auth_login_buckets(key_hash,window_start,attempts,failures)
        VALUES($1,clock_timestamp(),1,0) ON CONFLICT(key_hash) DO UPDATE SET
        attempts=CASE WHEN auth_login_buckets.window_start < clock_timestamp()-interval '15 minutes' THEN 1 ELSE auth_login_buckets.attempts+1 END,
        failures=CASE WHEN auth_login_buckets.window_start < clock_timestamp()-interval '15 minutes' THEN 0 ELSE auth_login_buckets.failures END,
        blocked_until=CASE WHEN auth_login_buckets.window_start < clock_timestamp()-interval '15 minutes' THEN NULL ELSE auth_login_buckets.blocked_until END,
        window_start=CASE WHEN auth_login_buckets.window_start < clock_timestamp()-interval '15 minutes' THEN clock_timestamp() ELSE auth_login_buckets.window_start END,
        updated_at=clock_timestamp()
        RETURNING attempts,blocked_until > clock_timestamp() AS blocked`, [keys[i]]);
      const row = result.rows[0];
      if (row.blocked || Number(row.attempts) > (i === 0 ? 100 : 20)) allowed = false;
    }
    await client.query("DELETE FROM auth_login_buckets WHERE key_hash IN (SELECT key_hash FROM auth_login_buckets WHERE updated_at < now()-interval '1 day' LIMIT 100)");
    return { allowed, keys };
  });
}

export async function finishLoginAttempt(attempt: LoginAttempt, success: boolean) {
  if (!attempt.allowed) return;
  await transaction(async client => {
    for (const key of [...attempt.keys].sort()) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`login:${key}`]);
    // Success does not erase IP spray history or request counters.
    if (success) await client.query("UPDATE auth_login_buckets SET failures=0,blocked_until=NULL WHERE key_hash=$1", [attempt.keys[1]]);
    else await client.query(`UPDATE auth_login_buckets SET failures=failures+1,
      blocked_until=CASE WHEN failures+1 >= 5 THEN clock_timestamp() + (least(900,30*power(2,least(5,failures-4))) * interval '1 second') ELSE blocked_until END,
      updated_at=clock_timestamp() WHERE key_hash=ANY($1::text[])`, [attempt.keys]);
  });
}

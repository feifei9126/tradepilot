import { readFileSync } from "node:fs";

/** One resolver shared by the web app, migrations and PostgreSQL client tools.
 * Restore credentials are never inherited from the live database settings. */
export function postgresEnv({ restore = false } = {}) {
  const prefix = restore ? "RESTORE_" : "";
  const label = `${prefix}DATABASE_URL`;
  const value = process.env[label]?.trim();
  let url;
  if (value) {
    try { url = new URL(value); } catch { throw new Error(`${label} must be a valid PostgreSQL URL`); }
    if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error(`${label} must use postgres:// or postgresql://`);
    // Avoid silently dropping TLS client options that we do not implement.
    const supported = new Set(["sslmode", "sslrootcert", "sslcert", "sslkey", "application_name", "connect_timeout", "channel_binding"]);
    for (const key of url.searchParams.keys()) {
      if (!supported.has(key) || url.searchParams.getAll(key).length !== 1) throw new Error(`Unsupported or duplicate PostgreSQL URL option: ${key}`);
    }
  }
  const get = (key, parameter) => parameter && url?.searchParams.has(parameter)
    ? url.searchParams.get(parameter) : process.env[`${prefix}${key}`];
  const env = compact({
    PGHOST: url ? url.hostname.replace(/^\[|\]$/g, "") : get("PGHOST")?.trim(),
    PGPORT: url?.port || get("PGPORT")?.trim() || "5432",
    PGUSER: url ? decodeURIComponent(url.username) : get("PGUSER")?.trim(),
    PGPASSWORD: url ? decodeURIComponent(url.password) : get("PGPASSWORD"),
    PGDATABASE: url ? decodeURIComponent(url.pathname.slice(1)) : get("PGDATABASE")?.trim(),
    PGSSLMODE: get("PGSSLMODE", "sslmode")?.trim().toLowerCase() || "disable",
    PGSSLROOTCERT: get("PGSSLROOTCERT", "sslrootcert")?.trim(),
    PGSSLCERT: get("PGSSLCERT", "sslcert")?.trim(),
    PGSSLKEY: get("PGSSLKEY", "sslkey")?.trim(),
    PGAPPNAME: get("PGAPPNAME", "application_name") || "tradepilot",
    PGCONNECT_TIMEOUT: get("PGCONNECT_TIMEOUT", "connect_timeout") || "10",
    PGCHANNELBINDING: get("PGCHANNELBINDING", "channel_binding"),
  });
  if (!env.PGHOST || !env.PGDATABASE || !env.PGUSER) throw new Error(`${label} or ${prefix}PGHOST/${prefix}PGDATABASE/${prefix}PGUSER is required`);
  if (!/^\d+$/.test(env.PGPORT) || Number(env.PGPORT) < 1 || Number(env.PGPORT) > 65535) throw new Error(`${prefix}PGPORT must be a valid TCP port`);
  if (!/^\d+$/.test(env.PGCONNECT_TIMEOUT) || Number(env.PGCONNECT_TIMEOUT) < 1 || Number(env.PGCONNECT_TIMEOUT) > 120) throw new Error("PGCONNECT_TIMEOUT must be between 1 and 120 seconds");
  if (!["disable", "require", "verify-ca", "verify-full"].includes(env.PGSSLMODE)) throw new Error("PGSSLMODE must be disable, require, verify-ca, or verify-full (prefer fallback is not supported)");
  if (["verify-ca", "verify-full"].includes(env.PGSSLMODE) && !env.PGSSLROOTCERT) throw new Error("verify-ca/verify-full require PGSSLROOTCERT (a readable CA certificate path)");
  if (env.PGSSLROOTCERT && !["verify-ca", "verify-full"].includes(env.PGSSLMODE)) throw new Error("PGSSLROOTCERT requires verify-ca/verify-full so web and client tools use the same verification policy");
  if (env.PGCHANNELBINDING && !["disable", "prefer"].includes(env.PGCHANNELBINDING)) throw new Error("channel_binding=require is not supported by the web driver; use prefer/disable or a verified driver");
  if (Boolean(env.PGSSLCERT) !== Boolean(env.PGSSLKEY)) throw new Error("PGSSLCERT and PGSSLKEY must be configured together");
  if (env.PGSSLCERT && env.PGSSLMODE === "disable") throw new Error("TLS client certificates require an enabled PGSSLMODE");
  return env;
}

export function postgresPoolConfig(options = {}) {
  const env = postgresEnv(options);
  let ssl = false;
  if (env.PGSSLMODE !== "disable") {
    ssl = { rejectUnauthorized: env.PGSSLMODE !== "require" };
    if (env.PGSSLROOTCERT) ssl.ca = readFileSync(env.PGSSLROOTCERT, "utf8");
    if (env.PGSSLCERT) ssl.cert = readFileSync(env.PGSSLCERT, "utf8");
    if (env.PGSSLKEY) ssl.key = readFileSync(env.PGSSLKEY, "utf8");
    // verify-ca checks the CA chain, not the hostname. verify-full leaves the
    // Node TLS hostname verifier enabled. Neither ever disables CA validation.
    if (env.PGSSLMODE === "verify-ca") ssl.checkServerIdentity = () => undefined;
  }
  return {
    host: env.PGHOST, port: Number(env.PGPORT), user: env.PGUSER,
    password: env.PGPASSWORD, database: env.PGDATABASE, ssl,
    application_name: env.PGAPPNAME,
    connectionTimeoutMillis: Number(env.PGCONNECT_TIMEOUT) * 1000,
    enableChannelBinding: env.PGCHANNELBINDING === "prefer",
  };
}

export function postgresProcessEnv(options = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG") && !key.startsWith("RESTORE_PG") && key !== "DATABASE_URL" && key !== "RESTORE_DATABASE_URL"));
  return { ...env, ...postgresEnv(options) };
}
function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== ""));
}

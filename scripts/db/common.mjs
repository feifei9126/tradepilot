import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import postgres from "postgres";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function requireDatabaseUrl(env = process.env) {
  const value = env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is required");

  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new Error("DATABASE_URL is invalid");
  }
  return value;
}

export function openSql(databaseUrl, options = {}) {
  const value = requireDatabaseUrl({ DATABASE_URL: databaseUrl });
  return postgres(value, {
    max: 1,
    onnotice: () => undefined,
    prepare: false,
    ...options,
  });
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function safeErrorMessage(error) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "UNKNOWN";
  return `数据库操作失败 (${code})`;
}

export function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === moduleUrl);
}

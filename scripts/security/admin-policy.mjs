export function assertAdminRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("管理员记录格式损坏，拒绝使用环境密码回退");
  if (record.passwordHash !== undefined && (typeof record.passwordHash !== "string" || !/^[0-9a-f]{32}:[0-9a-f]{64}$/i.test(record.passwordHash))) throw new Error("管理员密码哈希格式无效");
  if (record.sessionVersion !== undefined && typeof record.sessionVersion !== "string") throw new Error("管理员会话版本格式无效");
  if (record.mustChangePassword !== undefined && typeof record.mustChangePassword !== "boolean") throw new Error("管理员改密状态格式无效");
}

/** Shared by bootstrap, web authentication and the production entry point. */
export function isStrongAdminPassword(value) {
  if (typeof value !== "string" || value.length < 16 || value.length > 128 || new Set(value).size < 8) return false;
  if (/12345678|qwerty|replace-with|^password|^tradepilot|^admin/i.test(value)) return false;
  return [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter(pattern => pattern.test(value)).length >= 2;
}

export function assertAdminCredentialPolicy(record, env = process.env) {
  assertAdminRecord(record);
  if (env.NODE_ENV !== "production") return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.TRADEPILOT_ADMIN_EMAIL || "")) throw new Error("生产环境必须配置有效的管理员邮箱");
  // Saved passwords take precedence. Do not reset accounts during an upgrade.
  if (record.passwordHash) return;
  if (!isStrongAdminPassword(env.TRADEPILOT_ADMIN_PASSWORD)) throw new Error("生产管理员初始密码至少 16 位，须包含两类字符且不能使用公开示例或明显弱密码");
}

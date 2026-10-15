import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const secret = process.env.TRADEPILOT_CONFIG_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (secret.length < 32) throw new Error("租户密钥加密需要至少 32 字符的 TRADEPILOT_CONFIG_KEY 或 AUTH_SECRET");
  return createHash("sha256").update(`tradepilot-tenant-secret-v1:${secret}`).digest();
}

export function encryptTenantSecret(value: string, purpose: string, companyId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${purpose}:${companyId}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptTenantSecret(envelope: string, purpose: string, companyId: string) {
  try {
    const [version, ivText, tagText, dataText, extra] = envelope.split(".");
    if (version !== "v1" || !ivText || !tagText || !dataText || extra) throw new Error("envelope");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAAD(Buffer.from(`${purpose}:${companyId}`, "utf8"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("租户密钥解密失败，请检查 TRADEPILOT_CONFIG_KEY / AUTH_SECRET；不会覆盖原数据");
  }
}

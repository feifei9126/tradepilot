// AES-256-GCM 加密工具，用于安全存储 API Key

const ALGORITHM = "AES-GCM";

async function getKey(masterKey?: string): Promise<CryptoKey> {
  const keyMaterial = masterKey || process.env.LLM_MASTER_KEY || "tradepilot-default-master-key-change-me";
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.digest("SHA-256", encoder.encode(keyMaterial));
  return crypto.subtle.importKey("raw", keyData, { name: ALGORITHM }, false, ["encrypt", "decrypt"]);
}

export async function encryptApiKey(plaintext: string, masterKey?: string): Promise<string> {
  const key = await getKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return Buffer.from(combined).toString("base64");
}

export async function decryptApiKey(encryptedBase64: string, masterKey?: string): Promise<string> {
  try {
    const key = await getKey(masterKey);
    const combined = Buffer.from(encryptedBase64, "base64");
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("API Key 解密失败，可能主密钥已变更");
  }
}

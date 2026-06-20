// Simple password hashing using Web Crypto API
// Works in both Node.js and Cloudflare Workers / Edge Runtime

async function getKeyMaterial(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await getKeyMaterial(password);
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hash = new Uint8Array(derived);
  // Format: salt_hex:hash_hex
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hash).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const keyMaterial = await getKeyMaterial(password);
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hash = new Uint8Array(derived);
  const computedHex = Array.from(hash).map(b => b.toString(16).padStart(2, "0")).join("");
  return computedHex === hashHex;
}

async function getKeyMaterial(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
}

function toHex(value: Uint8Array) {
  return Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await getKeyMaterial(password);
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return `${toHex(salt)}:${toHex(new Uint8Array(derived))}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (
    !saltHex ||
    !hashHex ||
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]{64}$/i.test(hashHex)
  ) {
    return false;
  }

  const saltPairs = saltHex.match(/.{2}/g);
  if (!saltPairs) return false;
  const salt = new Uint8Array(
    saltPairs.map((pair) => Number.parseInt(pair, 16)),
  );
  const keyMaterial = await getKeyMaterial(password);
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 100_000,
        hash: "SHA-256",
      },
      keyMaterial,
      256,
    ),
  );
  const expectedPairs = hashHex.match(/.{2}/g);
  if (!expectedPairs || expectedPairs.length !== derived.length) return false;

  let difference = 0;
  for (let index = 0; index < derived.length; index += 1) {
    difference |= derived[index] ^ Number.parseInt(expectedPairs[index], 16);
  }
  return difference === 0;
}

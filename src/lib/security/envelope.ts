import { BusinessError } from "@/lib/business/errors";

const VERSION = "v1" as const;
const AES_KEY_BYTES = 32;
const MAX_SECRET_LENGTH = 1_000_000;

export interface SecretAad {
  companyId: string;
  recordId: string;
  purpose: string;
}

export interface SealedSecret {
  version: typeof VERSION;
  iv: string;
  ciphertext: string;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new Error("Invalid base64url");
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===";
  const binary = atob(padded.slice(0, padded.length - (padded.length % 4)));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function keyBytes(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? base64UrlToBytes(value) : value;
  if (bytes.byteLength !== AES_KEY_BYTES) {
    throw new BusinessError(
      "CREDENTIALS_KEY_INVALID",
      "Credential encryption key must contain 32 bytes",
      500,
    );
  }
  return new Uint8Array(bytes);
}

function associatedData(aad: SecretAad) {
  return new TextEncoder().encode(
    JSON.stringify({
      companyId: aad.companyId,
      purpose: aad.purpose,
      recordId: aad.recordId,
    }),
  );
}

function decryptionError(cause?: unknown): BusinessError {
  return new BusinessError(
    "CREDENTIALS_DECRYPT_FAILED",
    "Credential decryption failed",
    500,
    cause instanceof Error ? { cause } : undefined,
  );
}

export async function sealSecret(
  plaintext: string,
  key: string | Uint8Array,
  aad: SecretAad,
): Promise<SealedSecret> {
  if (typeof plaintext !== "string" || plaintext.length > MAX_SECRET_LENGTH) {
    throw new BusinessError(
      "CREDENTIALS_VALUE_INVALID",
      "Credential value is invalid",
      400,
    );
  }
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes(key),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: associatedData(aad), tagLength: 128 },
    cryptoKey,
    new TextEncoder().encode(plaintext),
  );
  return {
    version: VERSION,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function openSecret(
  sealed: SealedSecret,
  key: string | Uint8Array,
  aad: SecretAad,
): Promise<string> {
  if (
    !sealed ||
    sealed.version !== VERSION ||
    typeof sealed.iv !== "string" ||
    typeof sealed.ciphertext !== "string"
  ) {
    throw decryptionError();
  }

  try {
    const iv = base64UrlToBytes(sealed.iv);
    if (iv.byteLength !== 12) throw new Error("Invalid IV");
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes(key),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: associatedData(aad), tagLength: 128 },
      cryptoKey,
      base64UrlToBytes(sealed.ciphertext),
    );
    const value = new TextDecoder().decode(plaintext);
    if (value.length > MAX_SECRET_LENGTH) throw new Error("Secret too large");
    return value;
  } catch (error) {
    if (error instanceof BusinessError) throw error;
    throw decryptionError(error);
  }
}

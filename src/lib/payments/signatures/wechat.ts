import { createDecipheriv, createSign, createVerify } from "node:crypto";
import { BusinessError } from "@/lib/business/errors";

export function wechatSignatureMessage(method: string, path: string, timestamp: string, nonce: string, body: string) {
  return `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
}

export function wechatCallbackSignatureMessage(timestamp: string, nonce: string, body: string) {
  return `${timestamp}\n${nonce}\n${body}\n`;
}

export function signWechatRequest(method: string, path: string, timestamp: string, nonce: string, body: string, serial: string, privateKey: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(wechatSignatureMessage(method, path, timestamp, nonce, body));
  const signature = signer.sign(privateKey, "base64");
  return { authorization: `WECHATPAY2-SHA256-RSA2048 mchid="",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serial}",signature="${signature}"` };
}

export function verifyWechatCallback(_method: string, _path: string, body: string, headers: Headers | Record<string, string>, platformPublicKey: string, toleranceSeconds = 300, now = Math.floor(Date.now() / 1000)) {
  const get = (name: string) => headers instanceof Headers ? headers.get(name) : headers[name] || headers[name.toLowerCase()];
  const timestamp = get("Wechatpay-Timestamp") || "";
  const nonce = get("Wechatpay-Nonce") || "";
  const signature = get("Wechatpay-Signature") || "";
  const numericTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(numericTimestamp) || !nonce || !signature || Math.abs(now - numericTimestamp) > toleranceSeconds) return false;
  const verifier = createVerify("RSA-SHA256");
  verifier.update(wechatCallbackSignatureMessage(timestamp, nonce, body));
  return verifier.verify(platformPublicKey, signature, "base64");
}

export function decryptWechatResource(ciphertext: string, nonce: string, associatedData: string, apiV3Key: string) {
  const key = Buffer.from(apiV3Key, "utf8");
  if (key.length !== 32) throw new BusinessError("CREDENTIALS_VALUE_INVALID", "WeChat API v3 key must contain 32 bytes", 400);
  const encrypted = Buffer.from(ciphertext, "base64");
  const tag = encrypted.subarray(encrypted.length - 16);
  const data = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "utf8"));
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

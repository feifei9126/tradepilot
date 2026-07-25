import { lookup } from "node:dns/promises";
import { writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { join } from "node:path";

const MAX_BYTES = 15_000_000;
const CONTENT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function isPrivateAddress(address) {
  const normalized = String(address).toLowerCase().split("%")[0];
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (isIP(mapped || normalized) === 4) {
    const [a, b, c] = (mapped || normalized).split(".").map(Number);
    return a === 0 || a === 10 || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0 && c === 2)
      || (a === 198 && b >= 18 && b <= 19)
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113)
      || a >= 224;
  }
  if (isIP(normalized) === 6) {
    return normalized === "::" || normalized === "::1"
      || normalized.startsWith("fc") || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff")
      || normalized.startsWith("2001:db8:");
  }
  return true;
}

async function validateUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("unsupported source image URL");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("private source image URL");
  }
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("private source image URL");
  }
  return url;
}

async function readLimited(response) {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_BYTES || !response.body) throw new Error("source image is too large");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("source image is too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export async function downloadPublicImage(value, outputDir) {
  if (typeof value !== "string" || !value) return "";
  let url;
  try {
    url = await validateUrl(value);
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      const response = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": "TradePilot-Video-Worker/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) return "";
        url = await validateUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) return "";
      const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
      const extension = CONTENT_TYPES.get(contentType);
      if (!extension) return "";
      const bytes = await readLimited(response);
      if (!bytes.length) return "";
      const path = join(outputDir, `source.${extension}`);
      await writeFile(path, bytes);
      return path;
    }
  } catch {
    return "";
  }
  return "";
}

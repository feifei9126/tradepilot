import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function parseIpv4(address: string) {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

export function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const version = isIP(mappedIpv4 || normalized);

  if (version === 4) {
    const parts = parseIpv4(mappedIpv4 || normalized);
    if (!parts) return true;
    const [first, second, third] = parts;
    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 0)
      || (first === 192 && second === 168)
      || (first === 198 && second >= 18 && second <= 19)
      || (first === 198 && second === 51 && third === 100)
      || (first === 203 && second === 0 && third === 113)
      || first >= 224;
  }

  if (version === 6) {
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith("ff")
      || normalized.startsWith("2001:db8:");
  }

  return true;
}

export async function assertPublicUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("产品链接格式无效");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("产品链接只支持不含凭据的 HTTP 或 HTTPS URL");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("产品链接不能指向本机或局域网");
  }

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("产品链接解析到了不允许访问的网络地址");
  }
  return url;
}

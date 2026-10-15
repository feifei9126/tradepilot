import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateAddress } from "@/lib/firecrawl/security";
import { BillingError } from "@/lib/billing";

export type MailEndpoint = { host: string; port: number; secure: boolean; protocol: "smtp" | "imap" };
type Resolve = (host: string) => Promise<{ address: string; family: number }[]>;
const resolveHost: Resolve = host => lookup(host, { all: true, verbatim: true });

function privateAllowlist(host: string): string[] {
  try {
    const policy: unknown = JSON.parse(process.env.TRADEPILOT_MAIL_PRIVATE_ALLOWLIST || "{}");
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) return [];
    const addresses = (policy as Record<string, unknown>)[host];
    // Deliberately no wildcards, CIDRs, tenant-controlled flags or metadata access.
    return Array.isArray(addresses) ? addresses.filter((ip): ip is string => typeof ip === "string" && isIP(ip) === 4 && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) : [];
  } catch { return []; }
}

/** Validate on save AND immediately before connecting. All DNS answers must be
 * allowed; pin the selected numeric IP, retaining the original TLS SNI/name. */
export async function resolveMailEndpoint(endpoint: MailEndpoint, resolve: Resolve = resolveHost) {
  const host = endpoint.host.trim().toLowerCase().replace(/\.$/, "");
  const ipFamily = isIP(host);
  const validName = !ipFamily && host.length <= 253 && host.split(".").length >= 2 && host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  if (!ipFamily && !validName) throw new BillingError("邮箱服务器必须是有效的主机名或 IP 地址", 400, "MAIL_HOST_INVALID");
  const implicitPort = endpoint.protocol === "smtp" ? 465 : 993;
  const startTlsPort = endpoint.protocol === "smtp" ? 587 : 143;
  if (endpoint.port !== (endpoint.secure ? implicitPort : startTlsPort)) throw new BillingError(`只允许 ${implicitPort}（TLS）或 ${startTlsPort}（强制 STARTTLS）端口`, 400, "MAIL_TLS_PORT_REQUIRED");
  let addresses: { address: string; family: number }[];
  try { addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolve(host); }
  catch { throw new BillingError("邮箱服务器 DNS 解析失败", 400, "MAIL_DNS_FAILED"); }
  const allowlist = privateAllowlist(host);
  if (!addresses.length || addresses.some(({ address }) => !isIP(address) || (isPrivateAddress(address) && !allowlist.includes(address)))) {
    throw new BillingError("邮箱服务器不允许指向本机、内网、保留或云元数据地址", 400, "MAIL_NETWORK_DENIED");
  }
  return { address: addresses[0].address, servername: isIP(host) ? undefined : host, host, port: endpoint.port, secure: endpoint.secure };
}

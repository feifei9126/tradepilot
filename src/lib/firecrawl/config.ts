import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type FirecrawlManagedConfig = {
  managed: true;
  url: string;
  version: string;
  installedAt: string;
};

type FirecrawlEnvironment = Readonly<Record<string, string | undefined>>;

export function getTradePilotDataDirectory() {
  return resolve(
    process.env.TRADEPILOT_DATA_DIR || join(process.cwd(), "data"),
  );
}

export function getFirecrawlManagedConfigPath() {
  return join(getTradePilotDataDirectory(), "firecrawl-managed.json");
}

export function normalizeFirecrawlBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Firecrawl 地址格式无效");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Firecrawl 地址必须是不含凭据的 HTTP(S) URL");
  }

  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}

export function readManagedFirecrawlConfig(
  filePath = getFirecrawlManagedConfigPath(),
): FirecrawlManagedConfig | null {
  try {
    const parsed = JSON.parse(
      readFileSync(filePath, "utf8"),
    ) as Partial<FirecrawlManagedConfig>;
    if (
      parsed.managed !== true ||
      typeof parsed.url !== "string" ||
      typeof parsed.version !== "string" ||
      typeof parsed.installedAt !== "string"
    ) {
      return null;
    }
    return {
      managed: true,
      url: normalizeFirecrawlBaseUrl(parsed.url),
      version: parsed.version,
      installedAt: parsed.installedAt,
    };
  } catch {
    return null;
  }
}

export function getFirecrawlConfig(
  environment: FirecrawlEnvironment = process.env,
  managedConfigPath = getFirecrawlManagedConfigPath(),
) {
  const explicitUrl = environment.FIRECRAWL_API_URL?.trim();
  if (explicitUrl) {
    try {
      return {
        configured: true,
        url: normalizeFirecrawlBaseUrl(explicitUrl),
        hasApiKey: Boolean(environment.FIRECRAWL_API_KEY),
        managed: false,
        source: "environment" as const,
      };
    } catch (error: unknown) {
      return {
        configured: false,
        hasApiKey: Boolean(environment.FIRECRAWL_API_KEY),
        managed: false,
        source: "environment" as const,
        error:
          error instanceof Error ? error.message : "Firecrawl 地址格式无效",
      };
    }
  }

  const managedConfig = readManagedFirecrawlConfig(managedConfigPath);
  if (managedConfig) {
    return {
      configured: true,
      url: managedConfig.url,
      hasApiKey: false,
      managed: true,
      source: "managed" as const,
      version: managedConfig.version,
    };
  }

  return {
    configured: false,
    hasApiKey: Boolean(environment.FIRECRAWL_API_KEY),
    managed: false,
    source: "none" as const,
  };
}

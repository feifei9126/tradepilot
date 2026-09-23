import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import {
  configSchema,
  defaultConfig,
  mergeSecrets,
  type APIConfig,
  type SecretField,
} from "./schema";

type Stored = { revision: number; config: APIConfig };
export class ConfigConflict extends Error {}
export function createConfigStore(
  directory: string,
  encryptionSecret: string,
  defaults: APIConfig,
) {
  const path = join(directory, "ai-config.enc.json");
  const key = () => {
    if (encryptionSecret.length < 32)
      throw new Error(
        "API 配置加密需要至少 32 字符的 AUTH_SECRET 或 TRADEPILOT_CONFIG_KEY",
      );
    return createHash("sha256")
      .update(`tradepilot-api-config-v1:${encryptionSecret}`)
      .digest();
  };
  const read = (): Stored => {
    let raw: string;
    try {
      raw = readFileSync(/* turbopackIgnore: true */ path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { revision: 0, config: structuredClone(defaults) };
      throw new Error("无法读取 API 配置文件");
    }
    try {
      const envelope = JSON.parse(raw);
      if (envelope.version !== 1) throw new Error("version");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key(),
        Buffer.from(envelope.iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      const data = JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(envelope.data, "base64")),
          decipher.final(),
        ]).toString("utf8"),
      );
      if (!Number.isSafeInteger(data.revision) || data.revision < 1)
        throw new Error("revision");
      return {
        revision: data.revision,
        config: configSchema.parse(data.config),
      };
    } catch {
      throw new Error("API 配置解密失败，请检查加密密钥；不会覆盖原配置");
    }
  };
  const save = (
    next: APIConfig,
    revision: number,
    clear: SecretField[] = [],
  ): Stored => {
    // Synchronous compare-and-rename serializes writes in this single-instance Node deployment.
    const current = read();
    if (current.revision !== revision)
      throw new ConfigConflict("配置已被更新，请重新加载后保存");
    const config = configSchema.parse(
      mergeSecrets(configSchema.parse(next), current.config, clear),
    );
    const value = { revision: revision + 1, config };
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key(), iv);
    const data = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const tmp = `${path}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      writeFileSync(
        tmp,
        JSON.stringify({
          version: 1,
          iv: iv.toString("base64"),
          tag: cipher.getAuthTag().toString("base64"),
          data: data.toString("base64"),
        }),
        { mode: 0o600, flag: "wx" },
      );
      renameSync(tmp, path);
    } finally {
      try {
        unlinkSync(tmp);
      } catch {}
    }
    return value;
  };
  return { read, save };
}
export function configStore() {
  return createConfigStore(
    process.env.TRADEPILOT_DATA_DIR || "data",
    process.env.TRADEPILOT_CONFIG_KEY || process.env.AUTH_SECRET || "",
    defaultConfig(process.env),
  );
}
export function readAPIConfig() {
  return configStore().read().config;
}
export function serviceEnvironment(): NodeJS.ProcessEnv {
  const stored = configStore().read();
  const c = stored.config;
  return {
    ...process.env,
    TRADEPILOT_API_CONFIG_SAVED: stored.revision > 0 ? "true" : "",
    FIRECRAWL_API_URL: c.firecrawl.url,
    FIRECRAWL_API_KEY: c.firecrawl.apiKey,
    LIVEKIT_URL: c.livekit.url,
    LIVEKIT_API_KEY: c.livekit.apiKey,
    LIVEKIT_API_SECRET: c.livekit.apiSecret,
    LIVEKIT_AGENT_NAME: c.livekit.agentName,
  };
}

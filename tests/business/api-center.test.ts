import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AI_TASKS,
  configSchema,
  defaultConfig,
  redactConfig,
  voiceKey,
} from "../../src/lib/api-config/schema";
import {
  ConfigConflict,
  createConfigStore,
} from "../../src/lib/api-config/store";
import { resolveTextRequest } from "../../src/lib/api-config/resolve";

const secret = "unit-test-encryption-key-not-production-123456";
test("encrypted configuration persists, masks secrets, retains/clears and detects conflicts/tampering", () => {
  const dir = mkdtempSync(join(tmpdir(), "tradepilot-config-"));
  try {
    const store = createConfigStore(dir, secret, defaultConfig());
    assert.equal(store.read().revision, 0);
    const config = defaultConfig();
    config.text.apiKey = "sk-test-sensitive-value";
    config.text.customHeaders = '{"X-Secret":"private"}';
    config.livekit.apiSecret = "livekit-private";
    store.save(config, 0);
    const file = join(dir, "ai-config.enc.json");
    const encrypted = readFileSync(file, "utf8");
    assert.ok(!encrypted.includes(config.text.apiKey));
    assert.ok(!encrypted.includes("livekit-private"));
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(
      createConfigStore(dir, secret, defaultConfig()).read().config.text.apiKey,
      config.text.apiKey,
    );
    const safe = redactConfig(store.read().config, 1);
    assert.equal(safe.config.text.apiKey, "");
    assert.equal(safe.config.text.customHeaders, "");
    assert.equal(safe.secrets["livekit.apiSecret"], true);
    assert.equal(
      store.save(safe.config, 1).config.text.apiKey,
      config.text.apiKey,
    );
    assert.throws(() => store.save(config, 1), ConfigConflict);
    assert.equal(
      store.save(safe.config, 2, ["text.apiKey"]).config.text.apiKey,
      "",
    );
    assert.throws(
      () => createConfigStore(dir, secret + "wrong", defaultConfig()).read(),
      /解密失败/,
    );
    const damaged = JSON.parse(encrypted);
    damaged.tag = Buffer.alloc(16).toString("base64");
    writeFileSync(file, JSON.stringify(damaged));
    assert.throws(() => store.read(), /解密失败/);
    assert.throws(() => store.save(config, 0), /解密失败/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("all tasks use saved destination/key and optional task models; client cannot override credentials", () => {
  const config = defaultConfig();
  config.text.apiKey = "server-only";
  config.tasks.video_script = "alternate-model:tag";
  for (const task of Object.keys(AI_TASKS)) {
    const request = resolveTextRequest(config, task, {
      messages: [{ role: "user", content: "hello" }],
      ...{
        baseUrl: "https://evil.invalid",
        apiKey: "evil",
        model: "evil",
        proxyUrl: "https://evil.invalid",
      },
    });
    assert.equal(request.baseUrl, config.text.baseUrl);
    assert.equal(request.apiKey, "server-only");
    assert.equal(request.proxyUrl, undefined);
    assert.equal(
      request.model,
      task === "video_script" ? "alternate-model:tag" : config.text.model,
    );
  }
  assert.throws(
    () => resolveTextRequest(config, "toString", { messages: [] }),
    /未知/,
  );
  assert.throws(
    () => resolveTextRequest(defaultConfig(), "video_script", { messages: [] }),
    /API 配置中心/,
  );
});
test("strict configuration rejects credential URLs, unsafe headers and unknown task names", () => {
  const config = defaultConfig();
  assert.equal(
    configSchema.safeParse({ ...config, tasks: { toString: "model" } }).success,
    false,
  );
  for (const baseUrl of [
    "ftp://example.com",
    "https://key@example.com",
    "https://example.com?key=secret",
  ]) {
    assert.equal(
      configSchema.safeParse({ ...config, text: { ...config.text, baseUrl } })
        .success,
      false,
    );
  }
  assert.equal(
    configSchema.safeParse({
      ...config,
      text: { ...config.text, customHeaders: '{"Authorization":"bad"}' },
    }).success,
    false,
  );
});
test("Realtime key reuse only permits the official OpenAI provider", () => {
  const config = defaultConfig();
  config.text.apiKey = "text-key";
  config.voice.apiKey = "voice-key";
  assert.equal(voiceKey(config), "voice-key");
  config.voice.useTextKey = true;
  assert.equal(voiceKey(config), "text-key");
  config.text.baseUrl = "https://proxy.example/v1";
  assert.equal(voiceKey(config), "");
});

test("malformed provider responses and fetch failures never echo credential values", async () => {
  const { callChatCompletion } =
    await import("../../src/lib/ai/chat-completions");
  const original = globalThis.fetch;
  const config = defaultConfig();
  config.text.apiKey = "server-secret";
  const request = resolveTextRequest(config, "inquiry_reply", {
    messages: [{ role: "user", content: "test" }],
  });
  try {
    globalThis.fetch = async () => new Response("not json server-secret");
    await assert.rejects(callChatCompletion(request), {
      message: "AI 接口返回了无效 JSON",
    });
    globalThis.fetch = async () => {
      throw new Error("Header failure server-secret");
    };
    await assert.rejects(callChatCompletion(request), {
      message: "AI 接口连接失败，请检查地址、网络和鉴权配置",
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("changing a credential destination cannot silently forward an old saved secret", async () => {
  const { mergeSecrets } = await import("../../src/lib/api-config/schema");
  const current = defaultConfig();
  current.text.apiKey = "old-key";
  current.text.customHeaders = '{"X-Key":"old"}';
  current.firecrawl.apiKey = "fire-key";
  current.firecrawl.url = "https://old.example";
  const next = redactConfig(current, 1).config;
  next.text.baseUrl = "https://new.example/v1";
  next.firecrawl.url = "https://new.example";
  const merged = mergeSecrets(next, current, []);
  assert.equal(merged.text.apiKey, "");
  assert.equal(merged.text.customHeaders, "");
  assert.equal(merged.firecrawl.apiKey, "");
  next.text.apiKey = "explicit-new-key";
  assert.equal(mergeSecrets(next, current, []).text.apiKey, "explicit-new-key");
});

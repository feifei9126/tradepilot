import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TEXT_PROVIDER_IDS,
  TEXT_PROVIDERS,
  providerTextDefaults,
} from "../../src/lib/api-config/providers";
import {
  AI_TASKS,
  configSchema,
  defaultConfig,
  redactConfig,
  textReady,
  voiceKey,
} from "../../src/lib/api-config/schema";
import { createConfigStore } from "../../src/lib/api-config/store";
import { resolveTextRequest } from "../../src/lib/api-config/resolve";
import {
  buildChatCompletionUrl,
  callChatCompletion,
} from "../../src/lib/ai/chat-completions";

const endpoints = {
  kimi: "https://api.moonshot.cn/v1/chat/completions",
  doubao: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  gemini:
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  zhipu: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  siliconflow: "https://api.siliconflow.cn/v1/chat/completions",
};

test("every provider preset is valid; new account-specific model IDs remain explicit", () => {
  assert.equal(new Set(TEXT_PROVIDER_IDS).size, 12);
  for (const provider of TEXT_PROVIDER_IDS) {
    const config = defaultConfig();
    config.text = providerTextDefaults(provider);
    assert.equal(configSchema.parse(config).text.provider, provider);
    assert.equal(config.text.apiKey, "");
    assert.equal(config.text.requestPath, "/chat/completions");
    assert.ok(TEXT_PROVIDERS[provider].hint);
    if (!config.text.model) {
      config.text.apiKey = "mock-key";
      assert.equal(textReady(config), false);
    }
  }
  for (const [provider, url] of Object.entries(endpoints)) {
    assert.equal(buildChatCompletionUrl({ provider }), url);
    assert.equal(
      buildChatCompletionUrl({
        provider,
        baseUrl:
          TEXT_PROVIDERS[provider as keyof typeof endpoints].baseUrl + "/",
      }),
      url,
    );
  }
  for (const provider of [
    "custom",
    "newapi",
    "not-a-provider",
    "constructor",
  ]) {
    assert.throws(() => buildChatCompletionUrl({ provider }), /地址/);
  }
  assert.equal(
    buildChatCompletionUrl({
      provider: "newapi",
      baseUrl: "https://gateway.example/prefix/v1",
    }),
    "https://gateway.example/prefix/v1/chat/completions",
  );
});

test("all providers use the saved endpoint and bearer key for every AI task (mocked HTTP)", async (t) => {
  const calls: {
    url: string;
    init: RequestInit;
    body: Record<string, unknown>;
  }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, init, body });
    return Response.json({ choices: [{ message: { content: "OK" } }] });
  });
  for (const provider of TEXT_PROVIDER_IDS) {
    const config = defaultConfig();
    config.text = providerTextDefaults(provider);
    config.text.apiKey = "mock-" + provider;
    config.text.model = "account-model:tag";
    if (!config.text.baseUrl)
      config.text.baseUrl = "https://gateway.example/v1";
    config.tasks.video_script = "vendor/task-model:variant";
    for (const task of Object.keys(AI_TASKS)) {
      const request = resolveTextRequest(config, task, {
        messages: [{ role: "user", content: "hello" }],
        temperature: 0,
        ...{
          apiKey: "client-key",
          baseUrl: "https://untrusted.example",
          model: "wrong",
        },
      });
      await callChatCompletion(request);
      const last = calls.at(-1)!;
      assert.equal(last.url, config.text.baseUrl + "/chat/completions");
      assert.equal(
        (last.init.headers as Record<string, string>).Authorization,
        "Bearer mock-" + provider,
      );
      assert.equal(last.init.redirect, "error");
      assert.equal(
        last.body.model,
        task === "video_script"
          ? "vendor/task-model:variant"
          : "account-model:tag",
      );
      assert.equal(last.body.stream, undefined);
      // New vendors and gateways use model defaults; do not send an invalid fixed temperature.
      if (
        [
          "kimi",
          "doubao",
          "gemini",
          "zhipu",
          "openrouter",
          "siliconflow",
          "newapi",
        ].includes(provider)
      ) {
        assert.equal(last.body.temperature, undefined);
      }
    }
  }
  assert.equal(
    calls.length,
    TEXT_PROVIDER_IDS.length * Object.keys(AI_TASKS).length,
  );
});

test("provider IDs persist encrypted, old IDs still load, and non-OpenAI keys never reach Realtime", () => {
  const dir = mkdtempSync(join(tmpdir(), "tradepilot-providers-"));
  try {
    const store = createConfigStore(
      dir,
      "unit-test-provider-encryption-key-123456789",
      defaultConfig(),
    );
    let revision = 0;
    for (const provider of TEXT_PROVIDER_IDS) {
      const config = defaultConfig();
      config.text = providerTextDefaults(provider);
      config.text.apiKey = "mock-secret-" + provider;
      config.voice.useTextKey = true;
      store.save(config, revision++);
      const saved = store.read().config;
      assert.equal(saved.text.provider, provider);
      assert.equal(saved.text.apiKey, config.text.apiKey);
      assert.equal(redactConfig(saved, revision).config.text.apiKey, "");
      assert.equal(
        voiceKey(saved),
        provider === "openai" ? config.text.apiKey : "",
      );
      // Even a non-OpenAI preset with the official URL must not reuse its key.
      saved.text.baseUrl = "https://api.openai.com/v1";
      if (provider !== "openai") assert.equal(voiceKey(saved), "");
    }
    const previous = store.read().config;
    previous.text.provider = "openrouter";
    previous.text.baseUrl = TEXT_PROVIDERS.openrouter.baseUrl;
    previous.text.apiKey = "old-platform-secret";
    previous.text.customHeaders = '{"X-Private":"old-platform-header"}';
    store.save(previous, revision++);
    const next = redactConfig(store.read().config, revision).config;
    next.text = providerTextDefaults("kimi");
    const saved = store.save(next, revision).config;
    assert.equal(saved.text.apiKey, "");
    assert.equal(saved.text.customHeaders, "");
    assert.equal(saved.text.requestPath, "/chat/completions");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

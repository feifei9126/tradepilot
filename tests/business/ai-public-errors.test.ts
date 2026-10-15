import assert from "node:assert/strict";
import test from "node:test";
import { AIRequestConfigError, AIUpstreamError } from "../../src/lib/ai/chat-completions";
import { publicAIError } from "../../src/lib/ai/public-error";
import { TenantAIError } from "../../src/lib/tenant-ai";

test("AI errors expose only bounded, user-facing messages", () => {
  const upstream = publicAIError(new AIUpstreamError("provider response at https://private.example/key?token=secret", 429, "authorization: secret"));
  assert.equal(upstream.status, 503);
  assert.equal(upstream.message, "AI 服务商当前请求繁忙，请稍后重试。");
  assert.doesNotMatch(JSON.stringify(upstream), /private\.example|secret|authorization/i);

  const failedAuth = publicAIError(new AIUpstreamError("upstream says invalid key sk-secret", 401, "sk-secret"));
  assert.equal(failedAuth.status, 502);
  assert.doesNotMatch(JSON.stringify(failedAuth), /sk-secret/i);
});

test("safe tenant and local configuration errors retain actionable statuses", () => {
  assert.deepEqual(publicAIError(new TenantAIError("本月 AI Token 预算不足", 429)), {
    status: 429,
    message: "本月 AI Token 预算不足",
  });
  assert.deepEqual(publicAIError(new AIRequestConfigError("消息内容格式无效", 400)), {
    status: 400,
    message: "消息内容格式无效",
  });
});

test("unknown provider failures do not expose exception messages", () => {
  const result = publicAIError(new Error("Fetch failed for https://api.example/?key=secret"));
  assert.equal(result.status, 503);
  assert.equal(result.message, "AI 服务暂时不可用，请稍后重试。");
});

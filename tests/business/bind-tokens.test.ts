import assert from "node:assert/strict";
import test from "node:test";

import { consumeBindToken, createBindToken } from "../../src/lib/bind-tokens";
import { store } from "../../src/lib/store";

test("binding tokens are one-time credentials", () => {
  const token = createBindToken("whatsapp", "+86 13800138000", 1_000);
  const first = consumeBindToken(token.token, 2_000);
  assert.ok("pending" in first);
  if (!("pending" in first)) throw new Error("expected a pending binding");
  assert.equal(first.pending!.phone, "+86 13800138000");
  assert.deepEqual(consumeBindToken(token.token, 2_000), { error: "无效或已使用的二维码" });
});

test("expired binding tokens cannot be consumed", () => {
  const token = createBindToken("wechat", "+86 13900139000", 1_000);
  assert.deepEqual(consumeBindToken(token.token, 1_000 + 5 * 60 * 1000 + 1), { error: "二维码已过期" });
});

test("stored bindings can be removed", () => {
  store.bindings.set("test-phone", { channel: "wechat", phone: "test-phone", deviceId: "test-device", boundAt: "2026-07-23" });
  assert.equal(store.bindings.remove("test-phone"), true);
  assert.equal(store.bindings.get("test-phone"), null);
  assert.equal(store.bindings.remove("test-phone"), false);
});

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { encryptTenantSecret } from "../../src/lib/tenant-secret";
import {
  sendProviderText,
  ProviderError,
} from "../../src/lib/messaging/providers";
import type { ChannelAccount } from "../../src/lib/messaging/types";
process.env.TRADEPILOT_CONFIG_KEY = "provider-test-only-" + "x".repeat(40);
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const account: ChannelAccount = {
  id: "33333333-3333-4333-8333-333333333333",
  company_id: "44444444-4444-4444-8444-444444444444",
  channel: "whatsapp",
  name: "Test",
  config: { phoneNumberId: "1234567890", apiVersion: "v24.0" },
  enabled: true,
  secrets_ciphertext: "",
};
account.secrets_ciphertext = encryptTenantSecret(
  JSON.stringify({
    verifyToken: "test",
    appSecret: "a".repeat(32),
    accessToken: "TestAccessToken123456789",
  }),
  `messaging-account:${account.id}`,
  account.company_id,
);
test("WhatsApp transport posts an official text message using the saved server credential", async () => {
  let called = 0;
  globalThis.fetch = async (url, init) => {
    called++;
    assert.equal(
      String(url),
      "https://graph.facebook.com/v24.0/1234567890/messages",
    );
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer TestAccessToken123456789",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "15550001111",
      type: "text",
      text: { preview_url: false, body: "Hello" },
    });
    return Response.json({ messages: [{ id: "wamid.reply123" }] });
  };
  assert.equal(
    await sendProviderText(account, "15550001111", "Hello"),
    "wamid.reply123",
  );
  assert.equal(called, 1);
});
test("provider rejection has a safe error code without reflecting token or external error text", async () => {
  globalThis.fetch = async () =>
    Response.json(
      {
        error: { code: 190, message: "Token TestAccessToken123456789 expired" },
      },
      { status: 401 },
    );
  await assert.rejects(
    () => sendProviderText(account, "15550001111", "Hello"),
    (error: unknown) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "190");
      assert.equal(error.uncertain, false);
      assert.ok(!error.message.includes("TestAccessToken"));
      return true;
    },
  );
});
test("network and malformed successful response stay uncertain and never automatically retry", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("network");
  };
  await assert.rejects(
    () => sendProviderText(account, "15550001111", "Hello"),
    (error: unknown) => error instanceof ProviderError && error.uncertain,
  );
  assert.equal(calls, 1);
  globalThis.fetch = async () => Response.json({ messages: [] });
  await assert.rejects(
    () => sendProviderText(account, "15550001111", "Hello"),
    (error: unknown) => error instanceof ProviderError && error.uncertain,
  );
});

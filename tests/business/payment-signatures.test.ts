import assert from "node:assert/strict";
import { createHmac, createSign, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { verifyStripeSignature } from "../../src/lib/payments/signatures/stripe";
import { alipaySignContent, signAlipay, verifyAlipay } from "../../src/lib/payments/signatures/alipay";
import { verifyWechatCallback } from "../../src/lib/payments/signatures/wechat";
import { AlipayPaymentProvider } from "../../src/lib/payments/providers/alipay";
import { StripePaymentProvider } from "../../src/lib/payments/providers/stripe";
import { WechatPaymentProvider } from "../../src/lib/payments/providers/wechat";

test("Stripe signature validates raw body and timestamp", () => {
  const raw = JSON.stringify({ id: "evt_1" });
  const timestamp = 1700000000;
  const secret = "whsec_test";
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  assert.equal(verifyStripeSignature(raw, { "stripe-signature": `t=${timestamp},v1=${digest}` }, secret, timestamp), true);
  assert.equal(verifyStripeSignature(`${raw}x`, { "stripe-signature": `t=${timestamp},v1=${digest}` }, secret, timestamp), false);
});

test("Alipay RSA2 signs sorted non-empty parameters", () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const params = { app_id: "app", out_trade_no: "order", total_amount: "12.30" };
  assert.equal(alipaySignContent({ ...params, sign: "ignored" }), alipaySignContent(params));
  const signed = signAlipay(params, privateKey);
  assert.equal(verifyAlipay({ ...params, sign: signed }, publicKey), true);
  assert.equal(verifyAlipay({ ...params, total_amount: "12.31", sign: signed }, publicKey), false);
});

test("Alipay webhook parses large amounts without floating-point drift", async () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const params = {
    app_id: "app",
    notify_id: "notify-large",
    out_trade_no: "attempt-large",
    trade_no: "trade-large",
    trade_status: "TRADE_SUCCESS",
    total_amount: "90071992547409.90",
    currency: "CNY",
  };
  const raw = new URLSearchParams({ ...params, sign_type: "RSA2", sign: signAlipay(params, privateKey) }).toString();
  const events = await new AlipayPaymentProvider({ appId: "app", privateKey, publicKey }).verifyWebhook(raw, {});

  assert.equal(events[0]?.amountMinor, 9007199254740990);
});

test("Alipay webhook must match the configured application and seller", async () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const provider = new AlipayPaymentProvider({
    appId: "expected-app",
    sellerId: "expected-seller",
    privateKey,
    publicKey,
  });
  const callback = (overrides: Record<string, string>) => {
    const params = {
      app_id: "expected-app",
      seller_id: "expected-seller",
      notify_id: "notify-account-binding",
      out_trade_no: "attempt-account-binding",
      trade_no: "trade-account-binding",
      trade_status: "TRADE_SUCCESS",
      total_amount: "10.00",
      currency: "CNY",
      ...overrides,
    };
    return new URLSearchParams({ ...params, sign_type: "RSA2", sign: signAlipay(params, privateKey) }).toString();
  };

  await assert.rejects(provider.verifyWebhook(callback({ app_id: "other-app" }), {}), /account does not match/i);
  await assert.rejects(provider.verifyWebhook(callback({ seller_id: "other-seller" }), {}), /account does not match/i);
});

test("WeChat callback verifies the official timestamp nonce body canonical string", () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const timestamp = "1700000000";
  const nonce = "callback-nonce";
  const body = JSON.stringify({ id: "event-1" });
  const signer = createSign("RSA-SHA256");
  signer.update(`${timestamp}\n${nonce}\n${body}\n`);
  const signature = signer.sign(privateKey, "base64");

  assert.equal(verifyWechatCallback("POST", "/ignored/path", body, {
    "Wechatpay-Timestamp": timestamp,
    "Wechatpay-Nonce": nonce,
    "Wechatpay-Signature": signature,
  }, publicKey, 300, Number(timestamp)), true);
});

test("Stripe refund webhooks preserve the provider refund id and amount", async () => {
  const secret = "whsec_refund";
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: "evt_refund",
    type: "charge.refunded",
    data: { object: { payment_intent: "pi_refund", refunds: { data: [{ id: "re_refund", amount: 500, status: "succeeded" }] } } },
  });
  const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const events = await new StripePaymentProvider({ secretKey: "sk_test", webhookSecret: secret }).verifyWebhook(payload, { "stripe-signature": `t=${timestamp},v1=${digest}` });

  assert.deepEqual(events, [{ providerEventId: "evt_refund:re_refund", kind: "refund_succeeded", providerTransactionId: "pi_refund", refundId: "re_refund", refundAmountMinor: 500 }]);
});

test("WeChat refunds send the original payment total", async () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  let requestBody = "";
  let authorization = "";
  const provider = new WechatPaymentProvider({
    mchId: "merchant",
    appId: "app",
    serial: "serial",
    privateKey,
    platformPublicKey: publicKey,
    apiV3Key: "12345678901234567890123456789012",
    fetch: async (_url, init) => {
      requestBody = String(init?.body || "");
      authorization = String((init?.headers as Record<string, string>)?.Authorization || "");
      return Response.json({ refund_id: "wechat-refund" });
    },
  });
  const refundInput = { providerTransactionId: "wechat-payment", amountMinor: 500, totalAmountMinor: 1000, currency: "CNY", idempotencyKey: "refund-key" };

  await provider.refund(refundInput);

  assert.deepEqual(JSON.parse(requestBody).amount, { refund: 500, total: 1000, currency: "CNY" });
  assert.match(authorization, /mchid="merchant"/);
});

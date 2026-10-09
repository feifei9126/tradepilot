import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { POST } from "@/app/api/billing/webhook/route";
import { isSubscriptionPlanEligible, stripeSubscriptionId, verifyStripeSignature, handleStripeEvent } from "@/lib/billing";
import { effectiveAIQuota, hasCurrentSubscription, planFromRow } from "@/lib/billing/entitlements";

test("Stripe webhook rejects an oversized streamed body before reading it fully", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(1_000_001)); }, cancel() { cancelled = true; } });
  const response = await POST(new Request("http://localhost/api/billing/webhook", { method:"POST",headers:{ "stripe-signature":"irrelevant" },body:stream,duplex:"half" } as RequestInit));
  assert.equal(response.status,413); assert.equal(cancelled,true);
});

test("subscription identifiers support old/new Stripe invoice layouts, not invoice IDs", () => {
  assert.equal(stripeSubscriptionId("customer.subscription.deleted",{ id:"sub_12345" }),"sub_12345");
  assert.equal(stripeSubscriptionId("invoice.paid",{ parent:{ subscription_details:{ subscription:"sub_12345" } } }),"sub_12345");
  assert.equal(stripeSubscriptionId("invoice.payment_failed",{ subscription:{ id:"sub_12345" } }),"sub_12345");
  assert.equal(stripeSubscriptionId("invoice.paid",{ id:"in_12345" }),null);
  assert.equal(stripeSubscriptionId("checkout.session.completed",{ id:"sub_fake" }),null);
});

test("only trialing/active, unexpired paid subscriptions grant entitlements", () => {
  for (const status of ["past_due","unpaid","paused","incomplete","incomplete_expired","canceled","unknown",null]) {
    assert.equal(isSubscriptionPlanEligible(status),false);
    assert.equal(hasCurrentSubscription({ status,current_period_end:"2026-11-07T00:00:00Z" },Date.parse("2026-10-07")),false);
  }
  assert.equal(hasCurrentSubscription({ status:"active",current_period_end:"2026-11-07",cancel_at_period_end:true },Date.parse("2026-10-07")),true);
  assert.equal(hasCurrentSubscription({ status:"active",current_period_end:"2026-10-07" },Date.parse("2026-10-07")),false);
  assert.equal(hasCurrentSubscription({ status:"trialing",current_period_end:"2026-11-07",trial_end:"2026-10-06" },Date.parse("2026-10-07")),false);
  assert.equal(hasCurrentSubscription({ status:"active",current_period_end:null }),false);
});

test("AI caps take minimum plan/platform/tenant budget, preserve zero and fail closed", () => {
  const old = process.env.AI_PLATFORM_MONTHLY_REQUEST_LIMIT;
  try {
    process.env.AI_PLATFORM_MONTHLY_REQUEST_LIMIT = "80";
    const plan = { monthlyRequestLimit:100,monthlyTokenLimit:10000 };
    assert.deepEqual(effectiveAIQuota(plan,{ monthly_request_limit:10000,monthly_token_limit:5000 }),{ requestLimit:80,tokenLimit:5000 });
    assert.deepEqual(effectiveAIQuota(plan,{ monthly_request_limit:0,monthly_token_limit:0 }),{ requestLimit:0,tokenLimit:0 });
    assert.equal(effectiveAIQuota(plan,undefined,false).requestLimit,0);
    process.env.AI_PLATFORM_MONTHLY_REQUEST_LIMIT = "invalid";
    assert.equal(effectiveAIQuota(plan).requestLimit,0);
    assert.equal(planFromRow({ id:"closed",monthly_request_limit:0,monthly_token_limit:0,max_members:0 }).monthlyRequestLimit,0);
  } finally { if (old === undefined) delete process.env.AI_PLATFORM_MONTHLY_REQUEST_LIMIT; else process.env.AI_PLATFORM_MONTHLY_REQUEST_LIMIT = old; }
});

test("Stripe signatures reject tampering, expired timestamps and malformed event data before DB access", async () => {
  const secret = "test-only-stripe-webhook-secret", t = Math.floor(Date.now()/1000), payload = JSON.stringify({ id:"evt_invalid",type:"invoice.paid" });
  const signature = `t=${t},v1=${createHmac("sha256",secret).update(`${t}.${payload}`).digest("hex")}`;
  assert.equal(verifyStripeSignature(payload,signature,secret),true);
  assert.equal(verifyStripeSignature(payload+" ",signature,secret),false);
  assert.equal(verifyStripeSignature(payload,signature,secret,-1),false);
  const old = process.env.STRIPE_WEBHOOK_SECRET; process.env.STRIPE_WEBHOOK_SECRET = secret;
  try { await assert.rejects(handleStripeEvent(payload,signature), /事件标识或创建时间/); }
  finally { if (old === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = old; }
});

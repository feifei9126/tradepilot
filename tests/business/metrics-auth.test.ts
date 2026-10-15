import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../../src/app/api/metrics/route";
import { authorizeMetricsRequest } from "../../src/lib/metrics-auth";

const token = "0123456789abcdef0123456789abcdef";
const request = (authorization?: string) => new Request("http://localhost/api/metrics", {
  headers: authorization ? { authorization } : {},
});

test("metrics endpoint requires a configured high-entropy token", () => {
  assert.equal(authorizeMetricsRequest(request(), ""), "unconfigured");
  assert.equal(authorizeMetricsRequest(request(), "too-short"), "unconfigured");
  assert.equal(authorizeMetricsRequest(request(), ` ${token}`), "unconfigured");
});

test("metrics endpoint accepts only the exact Bearer token", () => {
  assert.equal(authorizeMetricsRequest(request(`Bearer ${token}`), token), "authorized");
  assert.equal(authorizeMetricsRequest(request(`bearer ${token}`), token), "authorized");
  assert.equal(authorizeMetricsRequest(request(), token), "unauthorized");
  assert.equal(authorizeMetricsRequest(request(`Basic ${token}`), token), "unauthorized");
  assert.equal(authorizeMetricsRequest(request(`Bearer ${token.slice(1)}`), token), "unauthorized");
  assert.equal(authorizeMetricsRequest(request(`Bearer ${"a".repeat(4097)}`), token), "unauthorized");
});

test("metrics route fails closed when disabled and does not echo bad credentials", async () => {
  const original = process.env.METRICS_TOKEN;
  try {
    delete process.env.METRICS_TOKEN;
    const disabled = await GET(request());
    assert.equal(disabled.status, 503);

    process.env.METRICS_TOKEN = token;
    const denied = await GET(request(`Bearer ${"x".repeat(token.length)}`));
    assert.equal(denied.status, 401);
    assert.equal(await denied.text(), "metrics endpoint unavailable\n");
    assert.equal(denied.headers.get("www-authenticate"), 'Bearer realm="metrics"');
  } finally {
    if (original === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = original;
  }
});

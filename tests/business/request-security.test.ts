import assert from "node:assert/strict";
import { test } from "node:test";
import { crossSiteMutation } from "../../src/lib/request-security";

test("cookie-authenticated tenant writes reject a foreign Origin and cross-site metadata", () => {
  const base = process.env.AUTH_URL || "http://localhost:3461";
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    assert.equal(crossSiteMutation(new Request(`${base}/api/contacts`, { method, headers: { origin: "https://attacker.invalid" } }))?.status, 403);
    assert.equal(crossSiteMutation(new Request(`${base}/api/contacts`, { method, headers: { "sec-fetch-site": "cross-site" } }))?.status, 403);
  }
});

test("same-origin writes, non-browser clients and reads remain supported", () => {
  const base = process.env.AUTH_URL || "http://localhost:3461";
  assert.equal(crossSiteMutation(new Request(`${base}/api/contacts`, { method: "POST", headers: { origin: new URL(base).origin } })), null);
  assert.equal(crossSiteMutation(new Request(`${base}/api/contacts`, { method: "DELETE" })), null);
  assert.equal(crossSiteMutation(new Request(`${base}/api/contacts`, { headers: { origin: "https://attacker.invalid" } })), null);
});

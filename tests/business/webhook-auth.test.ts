import assert from "node:assert/strict";
import test from "node:test";

import { hasValidWebhookSecret } from "../../src/lib/webhook-auth";

test("webhook authentication requires an exact bearer secret", () => {
  assert.equal(hasValidWebhookSecret("Bearer correct-secret", "correct-secret"), true);
  assert.equal(hasValidWebhookSecret("Bearer wrong-secret", "correct-secret"), false);
  assert.equal(hasValidWebhookSecret("Basic correct-secret", "correct-secret"), false);
  assert.equal(hasValidWebhookSecret(null, "correct-secret"), false);
  assert.equal(hasValidWebhookSecret("Bearer correct-secret", undefined), false);
});

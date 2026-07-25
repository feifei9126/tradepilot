import assert from "node:assert/strict";
import test from "node:test";

import { parseTaskMapping } from "../../src/hooks/useAIConfig";

test("task mappings preserve Ollama model tags containing colons", () => {
  assert.deepEqual(parseTaskMapping("ollama:phi4-mini:3.8b"), {
    providerId: "ollama",
    model: "phi4-mini:3.8b",
  });
  assert.equal(parseTaskMapping("invalid"), null);
});

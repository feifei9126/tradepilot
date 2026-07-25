import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOllamaBaseUrl } from "../../src/lib/ollama/base-url";

test("Ollama base URL removes OpenAI compatibility suffixes", () => {
  assert.equal(normalizeOllamaBaseUrl(undefined), "http://localhost:11434");
  assert.equal(
    normalizeOllamaBaseUrl("http://127.0.0.1:11434/v1/"),
    "http://127.0.0.1:11434",
  );
  assert.equal(
    normalizeOllamaBaseUrl("https://ollama.example.com/root/"),
    "https://ollama.example.com/root",
  );
});

test("Ollama base URL rejects embedded credentials", () => {
  assert.throws(
    () => normalizeOllamaBaseUrl("http://user:secret@localhost:11434"),
    /不含凭据/,
  );
});

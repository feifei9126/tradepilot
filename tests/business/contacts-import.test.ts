import assert from "node:assert/strict";
import test from "node:test";

import { importContacts } from "../../src/lib/ai/import-contacts";
import { defaultConfig } from "../../src/lib/api-config/schema";
import { resolveTextRequest } from "../../src/lib/api-config/resolve";
import { callChatCompletion } from "../../src/lib/ai/chat-completions";
import { store } from "../../src/lib/store";

test("contact import honors the complete configured AI endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ contacts: [{ name: "Audit Customer", country: "德国" }] }) } }],
    });
  };

  try {
    const config = defaultConfig();
    config.text = { ...config.text, provider: "ollama", model: "phi4-mini:3.8b", baseUrl: "http://127.0.0.1:11434/v1", customHeaders: '{"X-Audit":"enabled"}' };
    const response = await importContacts(new Request("http://localhost/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatText: "Customer asks for a quotation.",
        source: "WhatsApp",
        provider: "ollama",
        model: "phi4-mini:3.8b",
        baseUrl: "https://untrusted.example/v1",
        requestPath: "/chat/completions",
        userAgent: "TradePilot-Test",
        customHeaders: '{"X-Audit":"enabled"}',
      }),
    }) as never, (task, input) => callChatCompletion(resolveTextRequest(config, task, input)));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requestedUrl, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal((requestedInit?.headers as Record<string, string>)["X-Audit"], "enabled");
    assert.equal(JSON.parse(String(requestedInit?.body)).model, "phi4-mini:3.8b");
    assert.equal(payload.contacts[0].name, "Audit Customer");
    store.contacts.delete(payload.contacts[0].id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

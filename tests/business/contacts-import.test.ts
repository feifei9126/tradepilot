import assert from "node:assert/strict";
import test from "node:test";

import { GET as exportContacts } from "../../src/app/api/contacts/export/route";
import { POST } from "../../src/app/api/contacts/import/route";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

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
    const response = await POST(businessRequest("http://localhost/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatText: "Customer asks for a quotation.",
        source: "WhatsApp",
        provider: "ollama",
        model: "phi4-mini:3.8b",
        baseUrl: "http://127.0.0.1:11434/v1",
        requestPath: "/chat/completions",
        userAgent: "TradePilot-Test",
        customHeaders: '{"X-Audit":"enabled"}',
      }),
    }, contextA));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requestedUrl, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal((requestedInit?.headers as Record<string, string>)["User-Agent"], "TradePilot-Test");
    assert.equal((requestedInit?.headers as Record<string, string>)["X-Audit"], "enabled");
    assert.equal(JSON.parse(String(requestedInit?.body)).model, "phi4-mini:3.8b");
    assert.equal(payload.contacts[0].name, "Audit Customer");
    assert.equal(typeof payload.raw, "string");

    const otherTenantExport = await exportContacts(
      businessRequest("http://localhost/api/contacts/export", {}, contextB),
    );
    assert.doesNotMatch(await otherTenantExport.text(), /Audit Customer/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("contact import rejects an invalid batch without partial writes", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              contacts: [
                { name: "Valid Customer", email: "valid@example.com" },
                { name: "Invalid Customer", email: "not-an-email" },
              ],
            }),
          },
        },
      ],
    });
  try {
    const response = await POST(
      businessRequest(
        "http://localhost/api/contacts/import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatText: "Two customers",
            provider: "openai-compatible",
            model: "test-model",
            baseUrl: "https://ai.example.com/v1",
            apiKey: "test-key",
          }),
        },
        contextB,
      ),
    );
    const payload = await response.json();
    assert.equal(response.status, 422);
    assert.deepEqual(payload.contacts, []);
    assert.equal(Array.isArray(payload.errors), true);
    assert.equal(typeof payload.raw, "string");

    const otherTenantExport = await exportContacts(
      businessRequest("http://localhost/api/contacts/export", {}, contextB),
    );
    assert.doesNotMatch(await otherTenantExport.text(), /Valid Customer/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

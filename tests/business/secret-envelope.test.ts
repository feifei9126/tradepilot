import assert from "node:assert/strict";
import test from "node:test";

import { openSecret, sealSecret } from "../../src/lib/security/envelope";

const COMPANY_A = "10000000-0000-4000-8000-000000000001";
const COMPANY_B = "20000000-0000-4000-8000-000000000001";
const RECORD_ID = "30000000-0000-4000-8000-000000000001";
const KEY = Buffer.alloc(32, 7).toString("base64url");

const aad = (companyId: string) => ({
  companyId,
  recordId: RECORD_ID,
  purpose: "email",
});

test("encrypted credentials require the same tenant AAD", async () => {
  const sealed = await sealSecret("smtp-password", KEY, aad(COMPANY_A));

  await assert.rejects(
    openSecret(sealed, KEY, aad(COMPANY_B)),
    /decryption|key|credential/i,
  );
  assert.equal(await openSecret(sealed, KEY, aad(COMPANY_A)), "smtp-password");
});

test("tampered ciphertext is rejected without returning plaintext", async () => {
  const sealed = await sealSecret("resend-secret", KEY, aad(COMPANY_A));
  const tampered = {
    ...sealed,
    ciphertext: `${sealed.ciphertext.slice(0, -1)}${sealed.ciphertext.endsWith("A") ? "B" : "A"}`,
  };

  await assert.rejects(openSecret(tampered, KEY, aad(COMPANY_A)));
});

test("invalid master key length is rejected", async () => {
  await assert.rejects(
    sealSecret("secret", Buffer.alloc(16).toString("base64url"), aad(COMPANY_A)),
    /32|密钥/i,
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../src/", import.meta.url);

test("workspace switcher posts a selected organization and refreshes", async () => {
  const source = await readFile(new URL("components/organization-switcher.tsx", root), "utf8");
  assert.match(source, /\/api\/organizations\/switch/);
  assert.match(source, /router\.refresh\(\)/);
});

test("organization settings exposes member and invitation workflows", async () => {
  const source = await readFile(new URL("app/app/settings/organization/page.tsx", root), "utf8");
  assert.match(source, /\/api\/organizations\/members/);
  assert.match(source, /\/api\/organizations\/invitations/);
  assert.match(source, /role/);
  assert.match(source, /suspended/);
});

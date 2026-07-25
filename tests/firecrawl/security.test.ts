import assert from "node:assert/strict";
import test from "node:test";

import { isPrivateAddress } from "../../src/lib/firecrawl/security";

test("blocks private, loopback, link-local and documentation ranges", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fd00::1", "2001:db8::1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("1.1.1.1"), false);
  assert.equal(isPrivateAddress("2606:4700:4700::1111"), false);
});

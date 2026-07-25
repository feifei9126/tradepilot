import assert from "node:assert/strict";
import test from "node:test";

import { isPrivateAddress } from "../../workers/openmontage-adapter/safe-image.mjs";

test("local renderer blocks private source image addresses", () => {
  for (const address of ["127.0.0.1", "10.10.0.2", "172.31.0.1", "192.168.2.2", "::1", "fd00::1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("8.8.4.4"), false);
});

import test from "node:test";

import { createMemoryRepositoryFactory } from "../../src/lib/repositories/memory";
import { runRepositoryContract } from "./contract";

test("memory repository satisfies the business repository contract", async () => {
  const factory = createMemoryRepositoryFactory({ seedDemo: false });
  await runRepositoryContract((context) => factory.forTenant(context));
});

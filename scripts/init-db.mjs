import { runDatabaseInit } from "./db/init.mjs";
import { safeErrorMessage } from "./db/common.mjs";

runDatabaseInit().catch((error) => {
  console.error(safeErrorMessage(error));
  process.exitCode = 1;
});

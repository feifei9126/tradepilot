import { spawn } from "node:child_process";
import { resolve } from "node:path";

const projectDir = resolve(import.meta.dirname, "..");
const production = process.env.NODE_ENV === "production";
const webPort = process.env.TRADEPILOT_PORT || process.env.PORT || (production ? "3456" : "3458");
const workerPort = process.env.OPENMONTAGE_ADAPTER_PORT || "8787";
const workerUrl = process.env.OPENMONTAGE_WORKER_URL || `http://localhost:${workerPort}`;
const workspace = process.env.OPENMONTAGE_WORKSPACE || resolve(projectDir, "openmontage-workspace");
const shouldStartWorker = process.env.TRADEPILOT_START_VIDEO_WORKER !== "false";
const children = new Set();
let stopping = false;

function launch(command, args, env) {
  const child = spawn(command, args, {
    cwd: projectDir,
    env,
    stdio: "inherit",
  });
  children.add(child);
  child.on("exit", (code) => {
    children.delete(child);
    if (!stopping && code !== 0) {
      console.error(`${args[0]} exited with code ${code}`);
    }
  });
  return child;
}

async function workerIsRunning() {
  try {
    const response = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(1_500) });
    return response.ok;
  } catch {
    return false;
  }
}

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

const sharedEnv = {
  ...process.env,
  OPENMONTAGE_WORKER_URL: workerUrl,
  OPENMONTAGE_ADAPTER_PORT: workerPort,
  OPENMONTAGE_WORKSPACE: workspace,
};

if (shouldStartWorker && !await workerIsRunning()) {
  launch(process.execPath, ["workers/openmontage-adapter/server.mjs"], sharedEnv);
}

const nextBin = resolve(projectDir, "node_modules/next/dist/bin/next");
const web = launch(
  process.execPath,
  [nextBin, production ? "start" : "dev", "-p", webPort],
  sharedEnv,
);
web.on("exit", (code) => {
  stop();
  process.exitCode = code ?? 0;
});

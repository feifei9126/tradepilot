import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "v2.11.0";
const EXPECTED_COMMIT = "ef12eb36b2f3382838dfe0a0c1a5add3d5df7fe5";
const REPOSITORY = "https://github.com/firecrawl/firecrawl.git";
const API_URL = "http://127.0.0.1:3002";
const COMPOSE_PROJECT = "tradepilot-firecrawl";
const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(
  process.env.TRADEPILOT_DATA_DIR || join(projectDirectory, "data"),
);
const installDirectory = resolve(
  process.env.TRADEPILOT_FIRECRAWL_DIR ||
    join(homedir(), ".tradepilot", "firecrawl"),
);
const statusPath = join(dataDirectory, "firecrawl-deployment.json");
const managedConfigPath = join(dataDirectory, "firecrawl-managed.json");
const startedAt = new Date().toISOString();

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function atomicWrite(filePath, value, mode = 0o600) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = join(
    dirname(filePath),
    `.${basename(filePath)}-${process.pid}-${randomUUID()}.tmp`,
  );
  await writeFile(temporaryPath, value, { encoding: "utf8", mode });
  await rename(temporaryPath, filePath);
}

async function setStatus(phase, progress, message, extra = {}) {
  const status = {
    phase,
    progress,
    message,
    version: VERSION,
    pid: process.pid,
    startedAt,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  await atomicWrite(statusPath, JSON.stringify(status, null, 2));
  log(`${message} (${progress}%)`);
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    log(`执行: ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      cwd: options.cwd || projectDirectory,
      env: process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(stdout.trim());
        return;
      }
      const detail = stderr.trim().split(/\r?\n/).slice(-3).join(" ");
      reject(
        new Error(
          `${command} 执行失败（退出码 ${code ?? "未知"}）${detail ? `: ${detail}` : ""}`,
        ),
      );
    });
  });
}

async function ensureCommand(command, args, message) {
  try {
    await run(command, args, { capture: true });
  } catch {
    throw new Error(message);
  }
}

async function ensureRepository() {
  if (!existsSync(installDirectory)) {
    await mkdir(dirname(installDirectory), { recursive: true });
    await run("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      VERSION,
      "--recurse-submodules",
      "--shallow-submodules",
      REPOSITORY,
      installDirectory,
    ]);
  } else if (!existsSync(join(installDirectory, ".git"))) {
    throw new Error(
      `安装目录 ${installDirectory} 已存在但不是 Git 仓库，请移走该目录后重试`,
    );
  } else {
    const dirty = await run(
      "git",
      ["status", "--porcelain", "--untracked-files=no"],
      { cwd: installDirectory, capture: true },
    );
    if (dirty) {
      throw new Error(
        "托管的 Firecrawl 源码存在修改，为避免覆盖，请先备份或还原后重试",
      );
    }
    await run(
      "git",
      ["fetch", "--depth", "1", "origin", `refs/tags/${VERSION}`],
      {
        cwd: installDirectory,
      },
    );
    await run("git", ["checkout", "--detach", "FETCH_HEAD"], {
      cwd: installDirectory,
    });
    await run(
      "git",
      ["submodule", "update", "--init", "--recursive", "--depth", "1"],
      {
        cwd: installDirectory,
      },
    );
  }

  const commit = await run("git", ["rev-parse", "HEAD"], {
    cwd: installDirectory,
    capture: true,
  });
  if (commit !== EXPECTED_COMMIT) {
    throw new Error(
      `Firecrawl 版本校验失败，期望 ${EXPECTED_COMMIT.slice(0, 8)}`,
    );
  }
}

async function ensureEnvironment() {
  const environmentPath = join(installDirectory, ".env");
  try {
    const existing = await readFile(environmentPath, "utf8");
    if (!existing.includes("Managed by TradePilot")) {
      log("检测到已有 Firecrawl .env，保留现有配置");
    }
    return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const postgresPassword = randomBytes(24).toString("hex");
  const adminKey = randomBytes(24).toString("hex");
  const contents = [
    "# Managed by TradePilot. Do not commit this file.",
    "PORT=3002",
    "HOST=0.0.0.0",
    "USE_DB_AUTHENTICATION=false",
    `BULL_AUTH_KEY=${adminKey}`,
    "POSTGRES_USER=firecrawl",
    `POSTGRES_PASSWORD=${postgresPassword}`,
    "POSTGRES_DB=firecrawl",
    "NUM_WORKERS_PER_QUEUE=2",
    "CRAWL_CONCURRENT_REQUESTS=4",
    "MAX_CONCURRENT_JOBS=2",
    "BROWSER_POOL_SIZE=2",
    "",
  ].join("\n");
  await writeFile(environmentPath, contents, { encoding: "utf8", mode: 0o600 });
}

async function verifyScrape() {
  const deadline = Date.now() + 5 * 60_000;
  let lastError = "服务尚未响应";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/v1/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com",
          formats: ["markdown"],
          onlyMainContent: true,
          timeout: 30_000,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.success !== false && payload.data) return;
      lastError = payload.error || payload.message || `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "连接失败";
    }
    log(`等待 Firecrawl 就绪: ${lastError}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000));
  }
  throw new Error(`Firecrawl 启动超时: ${lastError}`);
}

async function main() {
  await setStatus("checking", 5, "检查 Git、Docker 和 Compose");
  await ensureCommand("git", ["--version"], "未安装 Git");
  await ensureCommand("docker", ["--version"], "未安装 Docker Desktop");
  await ensureCommand(
    "docker",
    ["compose", "version"],
    "未安装 Docker Compose",
  );
  await ensureCommand(
    "docker",
    ["info", "--format", "{{.ServerVersion}}"],
    "Docker Desktop 未启动",
  );

  await setStatus("downloading", 15, `下载 Firecrawl ${VERSION} 官方源码`);
  await ensureRepository();
  await ensureEnvironment();

  await setStatus(
    "building",
    35,
    "构建 Firecrawl、Playwright、PostgreSQL、Redis 和 RabbitMQ",
  );
  await run("docker", ["compose", "--project-name", COMPOSE_PROJECT, "build"], {
    cwd: installDirectory,
  });

  await setStatus("starting", 78, "启动 Firecrawl 完整服务栈");
  await run(
    "docker",
    ["compose", "--project-name", COMPOSE_PROJECT, "up", "-d"],
    { cwd: installDirectory },
  );

  await setStatus("verifying", 88, "执行真实网页抓取验证");
  await verifyScrape();

  const completedAt = new Date().toISOString();
  await atomicWrite(
    managedConfigPath,
    JSON.stringify(
      {
        managed: true,
        url: API_URL,
        version: VERSION,
        installedAt: completedAt,
      },
      null,
      2,
    ),
  );
  await setStatus("ready", 100, "Firecrawl 已部署并通过真实抓取验证", {
    completedAt,
  });
}

try {
  await mkdir(dataDirectory, { recursive: true });
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : "未知部署错误";
  await setStatus("failed", 0, "Firecrawl 部署失败", { error: message });
  log(message);
  process.exitCode = 1;
}

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { getTradePilotDataDirectory } from "./config";

const execFileAsync = promisify(execFile);
type FirecrawlEnvironment = Readonly<Record<string, string | undefined>>;

export const FIRECRAWL_MANAGED_VERSION = "v2.11.0";
export const FIRECRAWL_REPOSITORY = "https://github.com/firecrawl/firecrawl";
export const FIRECRAWL_MANAGED_URL = "http://127.0.0.1:3002";
export const FIRECRAWL_DEPLOY_COMMAND = "npm run firecrawl:deploy";

export type FirecrawlDeploymentPhase =
  | "idle"
  | "queued"
  | "checking"
  | "downloading"
  | "building"
  | "starting"
  | "verifying"
  | "ready"
  | "failed";

export type FirecrawlDeploymentStatus = {
  phase: FirecrawlDeploymentPhase;
  progress: number;
  message: string;
  version: string;
  pid?: number;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  error?: string;
};

export type FirecrawlPrerequisite = {
  ok: boolean;
  label: string;
  detail: string;
};

export type FirecrawlPrerequisites = {
  git: FirecrawlPrerequisite;
  docker: FirecrawlPrerequisite;
  compose: FirecrawlPrerequisite;
};

export function getFirecrawlDeploymentPaths() {
  const dataDirectory = getTradePilotDataDirectory();
  return {
    dataDirectory,
    status: join(dataDirectory, "firecrawl-deployment.json"),
    log: join(dataDirectory, "firecrawl-deployment.log"),
  };
}

export function defaultFirecrawlDeploymentStatus(): FirecrawlDeploymentStatus {
  return {
    phase: "idle",
    progress: 0,
    message: "尚未开始部署",
    version: FIRECRAWL_MANAGED_VERSION,
  };
}

export function isFirecrawlDeploymentActive(status: FirecrawlDeploymentStatus) {
  return [
    "queued",
    "checking",
    "downloading",
    "building",
    "starting",
    "verifying",
  ].includes(status.phase);
}

export function isLocalAuthUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      return true;
    }
    const octets = hostname.split(".").map(Number);
    return (
      octets.length === 4 &&
      octets.every((octet) => Number.isInteger(octet)) &&
      octets[0] === 127
    );
  } catch {
    return false;
  }
}

export function canDeployFirecrawlFromBrowser(
  environment: FirecrawlEnvironment = process.env,
  requestUrl?: string,
) {
  const override = environment.TRADEPILOT_ALLOW_SERVICE_DEPLOY?.toLowerCase();
  if (override === "true" || override === "1") return true;
  return (
    isLocalAuthUrl(environment.AUTH_URL) &&
    (!requestUrl || isLocalAuthUrl(requestUrl))
  );
}

export async function readFirecrawlDeploymentStatus() {
  try {
    const parsed = JSON.parse(
      await readFile(getFirecrawlDeploymentPaths().status, "utf8"),
    ) as Partial<FirecrawlDeploymentStatus>;
    if (
      typeof parsed.phase !== "string" ||
      typeof parsed.progress !== "number" ||
      typeof parsed.message !== "string"
    ) {
      return defaultFirecrawlDeploymentStatus();
    }
    return {
      ...defaultFirecrawlDeploymentStatus(),
      ...parsed,
      progress: Math.max(0, Math.min(100, parsed.progress)),
    } as FirecrawlDeploymentStatus;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultFirecrawlDeploymentStatus();
    }
    return {
      ...defaultFirecrawlDeploymentStatus(),
      phase: "failed" as const,
      message: "无法读取部署状态",
      error: error instanceof Error ? error.message : "状态文件损坏",
    };
  }
}

export async function writeFirecrawlDeploymentStatus(
  status: FirecrawlDeploymentStatus,
) {
  const paths = getFirecrawlDeploymentPaths();
  await mkdir(paths.dataDirectory, { recursive: true });
  const temporaryPath = join(
    paths.dataDirectory,
    `.firecrawl-deployment-${process.pid}-${randomUUID()}.tmp`,
  );
  await writeFile(temporaryPath, JSON.stringify(status, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, paths.status);
}

export async function readFirecrawlDeploymentLog(maxLines = 80) {
  try {
    const content = await readFile(getFirecrawlDeploymentPaths().log, "utf8");
    return content
      .replace(/\u001b\[[0-9;]*m/g, "")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-maxLines);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    return ["部署日志暂时无法读取"];
  }
}

function processIsAlive(pid: number | undefined) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function reconcileFirecrawlDeploymentStatus(
  status: FirecrawlDeploymentStatus,
) {
  if (!isFirecrawlDeploymentActive(status)) return status;
  if (processIsAlive(status.pid)) return status;

  const updatedAt = Date.parse(status.updatedAt || status.startedAt || "");
  if (Number.isFinite(updatedAt) && Date.now() - updatedAt < 30_000) {
    return status;
  }

  const failedStatus: FirecrawlDeploymentStatus = {
    ...status,
    phase: "failed",
    message: "部署进程已意外停止",
    error: "请查看部署日志后重试",
    updatedAt: new Date().toISOString(),
  };
  await writeFirecrawlDeploymentStatus(failedStatus);
  return failedStatus;
}

async function checkCommand(
  command: string,
  args: string[],
  label: string,
): Promise<FirecrawlPrerequisite> {
  try {
    const result = await execFileAsync(command, args, {
      timeout: 8_000,
      maxBuffer: 1024 * 1024,
    });
    const detail = `${result.stdout || result.stderr}`.trim().split(/\r?\n/)[0];
    return { ok: true, label, detail: detail || "已就绪" };
  } catch (error: unknown) {
    const detail =
      error instanceof Error && error.message.includes("docker info")
        ? "请先启动 Docker Desktop"
        : "未检测到或当前不可用";
    return { ok: false, label, detail };
  }
}

let prerequisiteCache:
  { expiresAt: number; value: FirecrawlPrerequisites } | undefined;

export async function checkFirecrawlPrerequisites(useCache = true) {
  if (
    useCache &&
    prerequisiteCache &&
    prerequisiteCache.expiresAt > Date.now()
  ) {
    return prerequisiteCache.value;
  }

  const [git, dockerVersion, compose, dockerDaemon] = await Promise.all([
    checkCommand("git", ["--version"], "Git"),
    checkCommand("docker", ["--version"], "Docker"),
    checkCommand("docker", ["compose", "version"], "Docker Compose"),
    checkCommand(
      "docker",
      ["info", "--format", "{{.ServerVersion}}"],
      "Docker",
    ),
  ]);
  const docker =
    dockerVersion.ok && dockerDaemon.ok
      ? { ...dockerVersion, detail: `Docker Engine ${dockerDaemon.detail}` }
      : {
          ok: false,
          label: "Docker",
          detail: dockerVersion.ok
            ? "Docker 已安装，请启动 Docker Desktop"
            : "未安装 Docker Desktop",
        };
  const value = { git, docker, compose };
  prerequisiteCache = { expiresAt: Date.now() + 15_000, value };
  return value;
}

export function firecrawlPrerequisitesReady(
  prerequisites: FirecrawlPrerequisites,
) {
  return Object.values(prerequisites).every((item) => item.ok);
}

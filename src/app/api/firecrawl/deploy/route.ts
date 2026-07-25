import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import { resolve } from "node:path";

import {
  FIRECRAWL_DEPLOY_COMMAND,
  FIRECRAWL_MANAGED_VERSION,
  FIRECRAWL_REPOSITORY,
  canDeployFirecrawlFromBrowser,
  checkFirecrawlPrerequisites,
  firecrawlPrerequisitesReady,
  getFirecrawlDeploymentPaths,
  isFirecrawlDeploymentActive,
  readFirecrawlDeploymentLog,
  readFirecrawlDeploymentStatus,
  reconcileFirecrawlDeploymentStatus,
  writeFirecrawlDeploymentStatus,
} from "@/lib/firecrawl/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function deploymentPayload(
  requestUrl: string,
  useCachedPrerequisites = true,
) {
  const [rawStatus, prerequisites, logTail] = await Promise.all([
    readFirecrawlDeploymentStatus(),
    checkFirecrawlPrerequisites(useCachedPrerequisites),
    readFirecrawlDeploymentLog(),
  ]);
  const status = await reconcileFirecrawlDeploymentStatus(rawStatus);
  return {
    canDeploy: canDeployFirecrawlFromBrowser(process.env, requestUrl),
    prerequisites,
    prerequisitesReady: firecrawlPrerequisitesReady(prerequisites),
    status: { ...status, pid: undefined },
    logTail,
    version: FIRECRAWL_MANAGED_VERSION,
    repository: FIRECRAWL_REPOSITORY,
    cliCommand: FIRECRAWL_DEPLOY_COMMAND,
  };
}

export async function GET(request: Request) {
  return Response.json(await deploymentPayload(request.url));
}

export async function POST(request: Request) {
  if (!canDeployFirecrawlFromBrowser(process.env, request.url)) {
    return Response.json(
      {
        error:
          "远程站点默认禁止从网页启动系统服务，请在服务器运行 npm run firecrawl:deploy",
      },
      { status: 403 },
    );
  }

  const existingStatus = await reconcileFirecrawlDeploymentStatus(
    await readFirecrawlDeploymentStatus(),
  );
  if (isFirecrawlDeploymentActive(existingStatus)) {
    return Response.json(
      { error: "Firecrawl 正在部署，请等待当前任务完成" },
      { status: 409 },
    );
  }

  const prerequisites = await checkFirecrawlPrerequisites(false);
  if (!firecrawlPrerequisitesReady(prerequisites)) {
    return Response.json(
      { error: "部署条件未满足，请安装并启动 Docker Desktop", prerequisites },
      { status: 412 },
    );
  }

  const now = new Date().toISOString();
  await writeFirecrawlDeploymentStatus({
    phase: "queued",
    progress: 2,
    message: "部署任务已进入后台队列",
    version: FIRECRAWL_MANAGED_VERSION,
    startedAt: now,
    updatedAt: now,
  });

  const paths = getFirecrawlDeploymentPaths();
  const logFile = await open(paths.log, "w", 0o600);
  try {
    const child = spawn(
      process.execPath,
      [resolve(process.cwd(), "scripts/deploy-firecrawl.mjs")],
      {
        cwd: process.cwd(),
        detached: true,
        env: process.env,
        stdio: ["ignore", logFile.fd, logFile.fd],
      },
    );
    child.unref();
  } catch (error: unknown) {
    const failedAt = new Date().toISOString();
    await writeFirecrawlDeploymentStatus({
      phase: "failed",
      progress: 0,
      message: "无法启动部署任务",
      version: FIRECRAWL_MANAGED_VERSION,
      startedAt: now,
      updatedAt: failedAt,
      error: error instanceof Error ? error.message : "后台进程启动失败",
    });
    return Response.json({ error: "无法启动部署任务" }, { status: 500 });
  } finally {
    await logFile.close();
  }

  return Response.json(await deploymentPayload(request.url, false), {
    status: 202,
  });
}

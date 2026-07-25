import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORT = Number(
  process.env.PORT || process.env.OPENMONTAGE_ADAPTER_PORT || 8787,
);
const HOST = process.env.OPENMONTAGE_ADAPTER_HOST || "127.0.0.1";
const WORKSPACE = resolve(
  process.env.OPENMONTAGE_WORKSPACE ||
    join(process.cwd(), "openmontage-workspace"),
);
const INBOX_DIR = join(WORKSPACE, "inbox");
const JOBS_DIR = join(WORKSPACE, "jobs");
const OUTBOX_DIR = join(WORKSPACE, "outbox");
const ADAPTER_DIR = dirname(fileURLToPath(import.meta.url));
const PUBLIC_URL = (
  process.env.OPENMONTAGE_PUBLIC_URL || `http://localhost:${PORT}`
).replace(/\/$/, "");

const jobs = new Map();

function openMontageConfigured() {
  return Boolean(
    process.env.OPENMONTAGE_COMMAND &&
    process.env.OPENMONTAGE_COMMAND_ARGS_JSON,
  );
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function createJobId() {
  return `om_${randomUUID()}`;
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    script: job.script,
    videoUrl: job.videoUrl?.startsWith("/")
      ? `${PUBLIC_URL}${job.videoUrl}`
      : job.videoUrl,
    thumbnailUrl: job.thumbnailUrl?.startsWith("/")
      ? `${PUBLIC_URL}${job.thumbnailUrl}`
      : job.thumbnailUrl,
    pipeline: job.pipeline,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    handoffFile: job.handoffFile,
  };
}

function usesOpenMontage(job) {
  return job.engine === "openmontage";
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

function buildCommandArgs(job, handoffFile, outputDir) {
  if (!process.env.OPENMONTAGE_COMMAND_ARGS_JSON) return [];

  const parsed = JSON.parse(process.env.OPENMONTAGE_COMMAND_ARGS_JSON);
  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string")
  ) {
    throw new Error(
      "OPENMONTAGE_COMMAND_ARGS_JSON must be a JSON string array",
    );
  }

  const replacements = {
    "{jobId}": job.id,
    "{jobFile}": handoffFile,
    "{outputDir}": outputDir,
    "{workspace}": WORKSPACE,
  };

  return parsed.map((arg) =>
    Object.entries(replacements).reduce(
      (value, [key, replacement]) => value.replaceAll(key, replacement),
      arg,
    ),
  );
}

async function maybeRunCommand(job, handoffFile, outputDir) {
  const command = usesOpenMontage(job)
    ? process.env.OPENMONTAGE_COMMAND
    : process.execPath;
  if (!command) throw new Error("OpenMontage command is not configured");

  job.status = "rendering";
  job.progress = 25;
  job.updatedAt = new Date().toISOString();
  await writeJson(join(JOBS_DIR, job.id, "status.json"), publicJob(job));

  const args = usesOpenMontage(job)
    ? buildCommandArgs(job, handoffFile, outputDir)
    : [
        join(ADAPTER_DIR, "render-local.mjs"),
        "--job-file",
        handoffFile,
        "--output-dir",
        outputDir,
      ];
  const child = spawn(command, args, {
    cwd: process.env.OPENMONTAGE_REPO || WORKSPACE,
    env: {
      ...process.env,
      TRADEPILOT_VIDEO_JOB_ID: job.id,
      TRADEPILOT_VIDEO_JOB_FILE: handoffFile,
      TRADEPILOT_VIDEO_OUTPUT_DIR: outputDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  job.child = child;

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout = (stdout + chunk.toString()).slice(-1_000_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-1_000_000);
  });
  child.on("close", async (code) => {
    const resultPath = join(outputDir, "result.json");
    let result = {};
    try {
      result = JSON.parse(await readFile(resultPath, "utf8"));
    } catch {
      result = {};
    }

    if (code === 0) {
      job.status = result.status || "completed";
      job.progress =
        typeof result.progress === "number" ? result.progress : 100;
      job.script = result.script || job.script;
      job.videoUrl = result.videoUrl || job.videoUrl;
      job.thumbnailUrl = result.thumbnailUrl || job.thumbnailUrl;
      job.pipeline = result.pipeline || job.pipeline;
      job.error = undefined;
    } else {
      job.status = "failed";
      job.progress = Math.max(job.progress, 25);
      job.error =
        result.error ||
        stderr.slice(-2000) ||
        `OpenMontage command exited with ${code}`;
    }

    job.updatedAt = new Date().toISOString();
    job.child = undefined;
    await writeJson(join(JOBS_DIR, job.id, "logs.json"), {
      stdout,
      stderr,
      exitCode: code,
    });
    await writeJson(join(JOBS_DIR, job.id, "status.json"), publicJob(job));
  });
}

async function loadDiskStatus(jobId) {
  const current = jobs.get(jobId);
  const statusPath = join(JOBS_DIR, jobId, "status.json");
  try {
    const diskStatus = JSON.parse(await readFile(statusPath, "utf8"));
    const next = { ...(current || {}), ...diskStatus };
    jobs.set(jobId, next);
    return next;
  } catch {
    return current || null;
  }
}

async function handleCreate(req, res) {
  const payload = await readBody(req);
  if (!payload.product?.id || !payload.product?.name) {
    return json(res, 400, {
      error: "product.id and product.name are required",
    });
  }
  const engine = payload.engine === "openmontage" ? "openmontage" : "local";
  if (engine === "openmontage" && !openMontageConfigured()) {
    return json(res, 503, {
      error: "OpenMontage command and argument template are not configured",
    });
  }

  await mkdir(INBOX_DIR, { recursive: true });
  await mkdir(OUTBOX_DIR, { recursive: true });

  const now = new Date().toISOString();
  const id = createJobId();
  const outputDir = join(OUTBOX_DIR, id);
  const handoffFile = join(INBOX_DIR, `${id}.json`);
  const job = {
    id,
    engine,
    status: "queued",
    progress: 10,
    pipeline:
      engine === "openmontage" ? "openmontage-command" : "local-renderer",
    script: [
      `TradePilot 已为 ${payload.product.name} 创建产品视频任务。`,
      engine === "openmontage"
        ? "任务已提交到 OpenMontage 命令流水线。"
        : "正在使用内置本地渲染器生成可播放的验证成片。",
    ].join("\n"),
    createdAt: now,
    updatedAt: now,
    handoffFile,
  };

  await mkdir(outputDir, { recursive: true });
  await writeJson(handoffFile, {
    id,
    createdAt: now,
    source: "tradepilot",
    expectedResultFile: join(outputDir, "result.json"),
    instructions: [
      "Use OpenMontage as the video production workspace.",
      "Create a product marketing video from this JSON brief.",
      "Write final status to expectedResultFile with status, progress, script, videoUrl, and thumbnailUrl.",
    ],
    payload,
  });

  jobs.set(id, job);
  await writeJson(join(JOBS_DIR, id, "status.json"), publicJob(job));
  void maybeRunCommand(job, handoffFile, outputDir).catch(async (error) => {
    job.status = "failed";
    job.error =
      error instanceof Error ? error.message : "OpenMontage command failed";
    job.updatedAt = new Date().toISOString();
    await writeJson(join(JOBS_DIR, job.id, "status.json"), publicJob(job));
  });

  return json(res, 201, publicJob(job));
}

async function handleGetJob(req, res) {
  const jobId = parseJobId(req);
  if (!jobId) return json(res, 400, { error: "Invalid job id" });
  const job = await loadDiskStatus(jobId);
  if (!job) return json(res, 404, { error: "Job not found" });
  return json(res, 200, publicJob(job));
}

function parseJobId(req) {
  const value = decodeURIComponent(
    new URL(req.url, `http://${req.headers.host}`).pathname.split("/").pop() ||
      "",
  );
  return /^[a-zA-Z0-9_-]+$/.test(value) ? value : "";
}

async function handleDeleteJob(req, res) {
  const jobId = parseJobId(req);
  if (!jobId) return json(res, 400, { error: "Invalid job id" });
  const job = await loadDiskStatus(jobId);
  job?.child?.kill("SIGTERM");
  jobs.delete(jobId);
  await Promise.all([
    rm(join(JOBS_DIR, jobId), { recursive: true, force: true }),
    rm(join(OUTBOX_DIR, jobId), { recursive: true, force: true }),
    rm(join(INBOX_DIR, `${jobId}.json`), { force: true }),
  ]);
  res.writeHead(204);
  res.end();
}

async function handleAsset(req, res, url) {
  const [, , jobId, fileName] = url.pathname.split("/");
  if (
    !/^[a-zA-Z0-9_-]+$/.test(jobId || "") ||
    !["final.mp4", "thumbnail.jpg"].includes(fileName)
  ) {
    return json(res, 404, { error: "Asset not found" });
  }

  const filePath = join(OUTBOX_DIR, jobId, fileName);
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return json(res, 404, { error: "Asset not found" });
  }

  const contentType = fileName.endsWith(".mp4") ? "video/mp4" : "image/jpeg";
  const range = req.headers.range;
  if (range && fileName.endsWith(".mp4")) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) return json(res, 416, { error: "Invalid range" });
    const start = Number(match[1]);
    const end = match[2]
      ? Math.min(Number(match[2]), info.size - 1)
      : info.size - 1;
    if (start > end || start >= info.size)
      return json(res, 416, { error: "Range not satisfiable" });
    res.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${info.size}`,
      "Content-Length": end - start + 1,
      "Content-Type": contentType,
    });
    if (req.method === "HEAD") return res.end();
    return createReadStream(filePath, { start, end }).pipe(res);
  }

  res.writeHead(200, {
    "Accept-Ranges": "bytes",
    "Content-Length": info.size,
    "Content-Type": contentType,
  });
  if (req.method === "HEAD") return res.end();
  return createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        mode: "local-renderer",
        workspace: WORKSPACE,
        commandConfigured: openMontageConfigured(),
        engines: {
          local: true,
          openmontage: openMontageConfigured(),
        },
      });
    }

    if (req.method === "POST" && url.pathname === "/jobs") {
      return await handleCreate(req, res);
    }

    if (req.method === "GET" && url.pathname.startsWith("/jobs/")) {
      return await handleGetJob(req, res);
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/jobs/")) {
      return await handleDeleteJob(req, res);
    }

    if (
      ["GET", "HEAD"].includes(req.method || "") &&
      url.pathname.startsWith("/assets/")
    ) {
      return await handleAsset(req, res, url);
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `TradePilot OpenMontage adapter listening on http://${HOST}:${PORT}`,
  );
  console.log(`Workspace: ${WORKSPACE}`);
});

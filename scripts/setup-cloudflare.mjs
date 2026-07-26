import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const COMMANDS = {
  status: ["npm", ["run", "db:status"]],
  migrate: ["npm", ["run", "db:migrate"]],
  bootstrap: ["npm", ["run", "db:bootstrap"]],
  build: ["npm", ["run", "cfbuild"]],
  deploy: ["npx", ["wrangler", "deploy"]],
};

const NEXT_FIX = {
  status: "检查 Neon/PostgreSQL 网络访问和 DATABASE_URL 后重新运行 npm run setup:cloudflare",
  migrate: "确认 DATABASE_URL 有建表权限后运行 npm run db:migrate",
  bootstrap: "确认管理员邮箱和密码有效后运行 npm run db:bootstrap",
  seed: "确认已完成管理员初始化且 TRADEPILOT_SEED_DEMO=true 后运行 npm run db:seed",
  "secret DATABASE_URL": "在 Wrangler 当前账户中重新设置 DATABASE_URL secret",
  "secret AUTH_SECRET": "在 Wrangler 当前账户中重新设置 AUTH_SECRET secret",
  build: "先运行 npm run build 检查 Next.js 编译错误，再重新运行 npm run setup:cloudflare",
  deploy: "运行 npx wrangler login 或检查 Cloudflare Worker 权限后重试",
  health: "检查 Worker 路由和数据库 secret 后重新请求 /api/health",
};

function executable(command) {
  if (process.platform !== "win32") return command;
  if (command === "npm") return "npm.cmd";
  if (command === "npx") return "npx.cmd";
  return command;
}

export function createDefaultExec({ cwd = process.cwd() } = {}) {
  return (command, args = [], options = {}) =>
    new Promise((resolveResult, reject) => {
      const child = spawn(executable(command), args, {
        cwd: options.cwd || cwd,
        env: options.env || process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.once("error", reject);
      child.once("close", (status) =>
        resolveResult({ status: status ?? 1, stdout, stderr }),
      );
      if (options.input !== undefined) {
        child.stdin.end(String(options.input));
      } else {
        child.stdin.end();
      }
    });
}

function replaceSecrets(value, secrets) {
  let result = String(value ?? "");
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
    result = result.split(secret).join("[REDACTED]");
  }
  return result;
}

function normalizeHealthUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TRADEPILOT_HEALTH_URL must be a valid https:// URL");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("TRADEPILOT_HEALTH_URL must use https:// outside localhost");
  }
  return parsed.toString().replace(/\/$/, "");
}

function validateDatabaseUrl(value) {
  const databaseUrl = String(value || "").trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is invalid");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://");
  }
  return databaseUrl;
}

function validateAdminEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("TRADEPILOT_ADMIN_EMAIL is invalid");
  }
  return email;
}

function validateAdminPassword(value) {
  const password = String(value || "");
  if (password.length < 8 || password.length > 128) {
    throw new Error("TRADEPILOT_ADMIN_PASSWORD must contain 8-128 characters");
  }
  return password;
}

function generatedAuthSecret() {
  return crypto.randomBytes(32).toString("hex");
}

function extractWorkerUrl(output) {
  const matches = String(output || "").match(/https:\/\/[^\s'"`<>]+/g) || [];
  return matches
    .map((value) => value.replace(/[),.;]+$/, ""))
    .find((value) => !value.includes("developers.cloudflare.com")) || "";
}

function defaultPrompt() {
  const input = process.stdin;
  const output = process.stdout;
  const readline = createInterface({ input, output });
  let closed = false;
  const close = () => {
    if (!closed) {
      closed = true;
      readline.close();
    }
  };
  const ask = async (message, { secret = false } = {}) => {
    if (!secret || !input.isTTY || typeof input.setRawMode !== "function") {
      return readline.question(`${message}: `);
    }
    return new Promise((resolveAnswer, reject) => {
      output.write(`${message}: `);
      let answer = "";
      const onData = (chunk) => {
        const text = chunk.toString("utf8");
        if (text === "\u0003") {
          input.setRawMode(false);
          input.off("data", onData);
          output.write("\n");
          reject(new Error("Input cancelled"));
          return;
        }
        if (text === "\r" || text === "\n") {
          input.setRawMode(false);
          input.off("data", onData);
          output.write("\n");
          resolveAnswer(answer);
          return;
        }
        if (text === "\u007f") {
          answer = answer.slice(0, -1);
          return;
        }
        answer += text;
      };
      input.setRawMode(true);
      input.on("data", onData);
    });
  };
  return { ask, close };
}

async function readInput({ key, message, secret = false, env, prompt, nonInteractive, dryRun, fallback }) {
  const fromEnvironment = env[key];
  if (fromEnvironment !== undefined && String(fromEnvironment) !== "") return String(fromEnvironment);
  if (nonInteractive) throw new Error(`${key} is required in --non-interactive mode`);
  if (dryRun && fallback !== undefined) return fallback;
  return prompt(message, { secret });
}

export function parseCloudflareArgs(argv = process.argv.slice(2)) {
  const options = { dryRun: false, nonInteractive: false, seedDemo: undefined, healthUrl: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--non-interactive") options.nonInteractive = true;
    else if (argument === "--seed-demo") options.seedDemo = true;
    else if (argument === "--no-seed-demo") options.seedDemo = false;
    else if (argument === "--health-url") options.healthUrl = argv[++index] || "";
    else if (argument.startsWith("--health-url=")) options.healthUrl = argument.slice("--health-url=".length);
    else throw new Error(`Unknown option: ${argument}`);
  }
  return options;
}

export async function runCloudflareSetup({
  prompt: suppliedPrompt,
  exec: suppliedExec,
  fetch: suppliedFetch = globalThis.fetch,
  env = process.env,
  dryRun = false,
  nonInteractive = false,
  seedDemo = env.TRADEPILOT_SEED_DEMO === "true",
  healthUrl: suppliedHealthUrl = env.TRADEPILOT_HEALTH_URL,
  cwd = process.cwd(),
  log = console.log,
} = {}) {
  const promptController = suppliedPrompt ? null : defaultPrompt();
  const prompt = suppliedPrompt
    ? typeof suppliedPrompt === "function"
      ? suppliedPrompt
      : suppliedPrompt.ask.bind(suppliedPrompt)
    : promptController.ask;
  const secrets = new Set();
  const steps = [];
  const execute = suppliedExec || createDefaultExec({ cwd });
  const baseEnv = { ...process.env };
  let healthUrl = suppliedHealthUrl || "";

  try {
    const databaseFallback = "postgresql://dry-run.invalid/tradepilot";
    const emailFallback = "admin@example.invalid";
    const passwordFallback = "dry-run-password-not-used";
    const databaseUrl = validateDatabaseUrl(
      await readInput({
        key: "DATABASE_URL",
        message: "PostgreSQL/Neon DATABASE_URL",
        env,
        prompt,
        nonInteractive,
        dryRun,
        fallback: databaseFallback,
      }),
    );
    const adminEmail = validateAdminEmail(
      await readInput({
        key: "TRADEPILOT_ADMIN_EMAIL",
        message: "管理员邮箱",
        env,
        prompt,
        nonInteractive,
        dryRun,
        fallback: emailFallback,
      }),
    );
    const adminPassword = validateAdminPassword(
      await readInput({
        key: "TRADEPILOT_ADMIN_PASSWORD",
        message: "管理员密码",
        secret: true,
        env,
        prompt,
        nonInteractive,
        dryRun,
        fallback: passwordFallback,
      }),
    );
    const authSecret = String(env.AUTH_SECRET || "").trim() || generatedAuthSecret();
    secrets.add(databaseUrl);
    secrets.add(adminPassword);
    secrets.add(authSecret);

    const runStep = async (name, command, args, commandEnv = {}, input) => {
      steps.push(name);
      log(`${dryRun ? "[dry-run] " : ""}${name}: ${command} ${args.join(" ")}`);
      if (dryRun) return { status: 0, stdout: "", stderr: "" };
      let result;
      try {
        result = await execute(command, args, {
          cwd,
          env: { ...baseEnv, ...commandEnv },
          ...(input === undefined ? {} : { input: `${input}\n` }),
        });
      } catch (error) {
        throw new Error(`${name} failed: ${replaceSecrets(error.message, secrets)}. Next: ${NEXT_FIX[name]}`);
      }
      const stdout = replaceSecrets(result?.stdout, secrets);
      const stderr = replaceSecrets(result?.stderr, secrets);
      if (stdout.trim()) log(stdout.trim());
      if (Number(result?.status) !== 0) {
        const detail = stderr.trim() || stdout.trim() || "command exited with a non-zero status";
        throw new Error(`${name} failed: ${detail}. Next: ${NEXT_FIX[name]}`);
      }
      return { ...result, stdout, stderr };
    };

    await runStep("status", ...COMMANDS.status, { NODE_ENV: "production", DATABASE_URL: databaseUrl });
    await runStep("migrate", ...COMMANDS.migrate, { NODE_ENV: "production", DATABASE_URL: databaseUrl });
    await runStep("bootstrap", ...COMMANDS.bootstrap, {
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl,
      TRADEPILOT_ADMIN_EMAIL: adminEmail,
      TRADEPILOT_ADMIN_PASSWORD: adminPassword,
    });
    if (seedDemo) {
      await runStep("seed", "npm", ["run", "db:seed"], {
        NODE_ENV: "production",
        DATABASE_URL: databaseUrl,
        TRADEPILOT_ADMIN_EMAIL: adminEmail,
        TRADEPILOT_SEED_DEMO: "true",
      });
    }
    await runStep("secret DATABASE_URL", "npx", ["wrangler", "secret", "put", "DATABASE_URL"], {}, databaseUrl);
    await runStep("secret AUTH_SECRET", "npx", ["wrangler", "secret", "put", "AUTH_SECRET"], {}, authSecret);
    await runStep("build", ...COMMANDS.build);
    const deployResult = await runStep("deploy", ...COMMANDS.deploy);

    if (!healthUrl) {
      healthUrl = extractWorkerUrl(`${deployResult.stdout}\n${deployResult.stderr}`);
      if (!healthUrl && !nonInteractive && !dryRun) {
        healthUrl = await prompt("部署后的 Worker URL");
      }
    }
    if (!healthUrl && !dryRun) {
      throw new Error("health failed: TRADEPILOT_HEALTH_URL is required when Wrangler output has no Worker URL");
    }
    healthUrl = normalizeHealthUrl(healthUrl || "https://tradepilot.example.invalid");
    const healthEndpoint = `${healthUrl}/api/health`;
    steps.push("health");
    log(`${dryRun ? "[dry-run] " : ""}health: GET ${healthEndpoint}`);
    if (dryRun) return { dryRun: true, steps, health: { ok: true }, healthUrl };
    if (typeof suppliedFetch !== "function") throw new Error(`health failed: fetch is unavailable. Next: ${NEXT_FIX.health}`);
    let response;
    try {
      response = await suppliedFetch(healthEndpoint, { headers: { accept: "application/json" } });
    } catch (error) {
      throw new Error(`health failed: ${replaceSecrets(error.message, secrets)}. Next: ${NEXT_FIX.health}`);
    }
    let health;
    try {
      health = await response.json();
    } catch {
      health = null;
    }
    if (!response.ok || health?.status === "error" || health?.ok === false) {
      throw new Error(`health failed: Worker did not report a healthy database. Next: ${NEXT_FIX.health}`);
    }
    log("Cloudflare Worker 健康检查通过");
    return { dryRun: false, steps, health, healthUrl };
  } finally {
    promptController?.close();
  }
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  try {
    const options = parseCloudflareArgs();
    await runCloudflareSetup(options);
    console.log(options.dryRun ? "Cloudflare dry-run 完成，未执行外部命令。" : "Cloudflare 部署完成。管理员密码未上传到 Worker。 ");
  } catch (error) {
    console.error(`Cloudflare 部署失败：${error instanceof Error ? error.message : "未知错误"}`);
    process.exitCode = 1;
  }
}

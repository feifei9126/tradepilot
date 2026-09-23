import { randomUUID } from "node:crypto";
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
  TrackSource,
} from "livekit-server-sdk";
import { sessionRequestSchema } from "./contracts";

type Environment = Record<string, string | undefined>;
const requiredKeys = [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
] as const;
export const MAX_SESSION_SECONDS = 15 * 60;
const headers = { "Cache-Control": "no-store, private" };

export function livekitConfig(env: Environment = process.env) {
  const missing = requiredKeys.filter((key) => !env[key]?.trim());
  let validUrl = false;
  try {
    const url = new URL(env.LIVEKIT_URL || "");
    validUrl =
      ["wss:", "ws:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      (env.NODE_ENV !== "production" || url.protocol === "wss:");
  } catch {
    /* Report configuration state, never credential values. */
  }
  return { configured: missing.length === 0 && validUrl, missing, validUrl };
}

// Single-process guard, not a distributed quota. Use an ingress/shared limiter for replicas.
export function createSessionLimiter() {
  const attempts = new Map<string, { count: number; expires: number }>();
  return (userId: string, now = Date.now()) => {
    for (const [key, entry] of attempts)
      if (entry.expires <= now) attempts.delete(key);
    const entry = attempts.get(userId);
    if (entry && entry.count >= 5) return false;
    if (!entry && attempts.size >= 10_000) return false;
    attempts.set(userId, {
      count: (entry?.count || 0) + 1,
      expires: entry?.expires || now + 60_000,
    });
    return true;
  };
}
const limiterState = globalThis as typeof globalThis & {
  livekitSessionLimiter?: ReturnType<typeof createSessionLimiter>;
};
const allowSession = (limiterState.livekitSessionLimiter ??=
  createSessionLimiter());

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 24_000) {
        await reader.cancel();
        throw new Error("body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function createSessionResponse(
  request: Request,
  userId: string | undefined,
  env: Environment = process.env,
  allow: (id: string) => boolean = allowSession,
): Promise<Response> {
  const error = (message: string, status: number) =>
    Response.json({ error: message }, { status, headers });
  if (!userId) return error("请先登录", 401);
  const origin = request.headers.get("origin");
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(env.AUTH_URL || request.url).origin;
  } catch {
    return error("站点地址配置无效", 503);
  }
  if (origin && origin !== expectedOrigin)
    return error("不允许跨站创建语音会话", 403);
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return error("请使用 JSON 请求", 415);
  }
  if (!livekitConfig(env).configured)
    return error(
      "尚未完成语音配置，请前往「系统 → API 配置中心」",
      503,
    );
  let body: unknown;
  try {
    body = await readBody(request);
  } catch {
    return error("请求 JSON 无效或超过大小限制", 400);
  }
  const parsed = sessionRequestSchema.safeParse(body);
  if (!parsed.success)
    return error(
      "请选择有效场景、语言并确认语音数据处理；业务说明最多 4000 字",
      400,
    );
  if (!allow(userId))
    return Response.json(
      { error: "创建会话过于频繁，请一分钟后重试" },
      {
        status: 429,
        headers: { ...headers, "Retry-After": "60" },
      },
    );
  try {
    const roomName = `tradepilot-${randomUUID()}`;
    const identity = `operator-${randomUUID()}`;
    const token = new AccessToken(
      env.LIVEKIT_API_KEY!.trim(),
      env.LIVEKIT_API_SECRET!.trim(),
      {
        identity,
        name: "TradePilot operator",
        ttl: "5m",
      },
    );
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE],
      canPublishData: false,
      canUpdateOwnMetadata: false,
    });
    token.roomConfig = new RoomConfiguration({
      name: roomName,
      maxParticipants: 2,
      emptyTimeout: 60,
      departureTimeout: 20,
      agents: [
        new RoomAgentDispatch({
          agentName:
            env.LIVEKIT_AGENT_NAME?.trim() || "tradepilot-customer-service",
          metadata: JSON.stringify({
            version: 1,
            mode: parsed.data.mode,
            language: parsed.data.language,
            brief: parsed.data.brief,
            participant_identity: identity,
            max_session_seconds: MAX_SESSION_SECONDS,
          }),
        }),
      ],
    });
    return Response.json(
      {
        serverUrl: env.LIVEKIT_URL!.trim(),
        participantToken: await token.toJwt(),
        roomName,
      },
      { headers },
    );
  } catch {
    // Do not log token contents, credentials or customer briefing data.
    return error("无法创建语音会话，请检查 LiveKit 服务端配置", 500);
  }
}

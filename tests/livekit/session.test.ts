import assert from "node:assert/strict";
import test from "node:test";
import { TokenVerifier } from "livekit-server-sdk";
import {
  createSessionLimiter,
  createSessionResponse,
  livekitConfig,
  MAX_SESSION_SECONDS,
} from "../../src/lib/livekit/server";
import {
  agentEventSchema,
  sessionRequestSchema,
} from "../../src/lib/livekit/contracts";

const env = {
  NODE_ENV: "test",
  LIVEKIT_URL: "wss://voice.example.com",
  LIVEKIT_API_KEY: "test-key",
  LIVEKIT_API_SECRET: "test-only-secret-not-for-production-123456",
  LIVEKIT_AGENT_NAME: "test-agent",
};
const body = {
  mode: "support",
  language: "zh",
  brief: "公开售后政策",
  consent: true,
};
function request(value: unknown = body, headers: Record<string, string> = {}) {
  return new Request("https://tradepilot.example/api/livekit/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(value),
  });
}
const create = (
  req = request(),
  user: string | undefined = "operator",
  config = env,
) => createSessionResponse(req, user, config, () => true);

test("configuration validates secure production WebSocket URLs without leaking secrets", () => {
  assert.equal(livekitConfig(env).configured, true);
  assert.equal(
    livekitConfig({ ...env, LIVEKIT_URL: "https://voice.example" }).configured,
    false,
  );
  assert.equal(
    livekitConfig({ ...env, LIVEKIT_URL: "ws://localhost:7880" }).configured,
    true,
  );
  assert.equal(
    livekitConfig({
      ...env,
      NODE_ENV: "production",
      LIVEKIT_URL: "ws://localhost:7880",
    }).configured,
    false,
  );
  assert.equal(
    livekitConfig({ ...env, LIVEKIT_URL: "wss://user:pass@example.com" })
      .configured,
    false,
  );
  assert.deepEqual(livekitConfig({}).missing, [
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
  ]);
  assert.ok(
    !JSON.stringify(livekitConfig(env)).includes(env.LIVEKIT_API_SECRET),
  );
});

test("rejects anonymous, cross-origin, unconfigured and non-JSON requests", async () => {
  assert.equal(
    (await createSessionResponse(request(), undefined, env)).status,
    401,
  );
  assert.equal(
    (await create(request(body, { Origin: "https://attacker.example" })))
      .status,
    403,
  );
  assert.equal(
    (await create(request(body, { "Content-Type": "text/plain" }))).status,
    415,
  );
  assert.equal(
    (await create(request(), "operator", { ...env, LIVEKIT_API_SECRET: "" }))
      .status,
    503,
  );
  assert.equal(
    (await create(request(body, { Origin: "https://tradepilot.example" })))
      .status,
    200,
  );
});

test("rejects malformed, oversized, unsupported and unconsented input", async () => {
  for (const value of [
    null,
    [],
    {},
    { ...body, consent: false },
    { ...body, mode: "outbound" },
    { ...body, language: "bad" },
    { ...body, brief: "x".repeat(4001) },
    { ...body, roomName: "another-tenant" },
  ]) {
    assert.equal((await create(request(value))).status, 400);
  }
  assert.equal(
    (
      await create(
        new Request("https://tradepilot.example/api/livekit/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await create(request({ ...body, brief: "x".repeat(30_000) }))).status,
    400,
  );
  assert.equal(
    sessionRequestSchema.safeParse({ ...body, brief: "中文".repeat(2000) })
      .success,
    true,
  );
});

test("issues unique short-lived microphone-only tokens with named dispatch and bounded metadata", async () => {
  const response = await create();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
  const data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), [
    "participantToken",
    "roomName",
    "serverUrl",
  ]);
  const claims = await new TokenVerifier(
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  ).verify(data.participantToken);
  assert.equal(claims.video?.room, data.roomName);
  assert.equal(claims.video?.roomJoin, true);
  assert.equal(claims.video?.roomAdmin, undefined);
  assert.equal(claims.video?.roomList, undefined);
  assert.equal(claims.video?.canPublishData, false);
  assert.equal(claims.video?.canUpdateOwnMetadata, false);
  assert.deepEqual(claims.video?.canPublishSources, ["microphone"]);
  const jwt = JSON.parse(
    Buffer.from(data.participantToken.split(".")[1], "base64url").toString(),
  );
  assert.ok(jwt.exp - jwt.nbf <= 300);
  assert.match(jwt.sub, /^operator-/);
  assert.equal(jwt.roomConfig.maxParticipants, 2);
  const dispatch = jwt.roomConfig.agents[0];
  assert.equal(dispatch.agentName, "test-agent");
  assert.deepEqual(JSON.parse(dispatch.metadata), {
    version: 1,
    mode: body.mode,
    language: body.language,
    brief: body.brief,
    participant_identity: jwt.sub,
    max_session_seconds: MAX_SESSION_SECONDS,
  });
  assert.notEqual((await (await create()).json()).roomName, data.roomName);
  assert.ok(!JSON.stringify(data).includes(env.LIVEKIT_API_SECRET));
});

test("rate limiting isolates users, expires and returns retry guidance", async () => {
  const allow = createSessionLimiter();
  for (let n = 0; n < 5; n++) assert.equal(allow("one", 1000), true);
  assert.equal(allow("one", 1000), false);
  assert.equal(allow("two", 1000), true);
  assert.equal(allow("one", 61_000), true);
  const response = await createSessionResponse(
    request(),
    "one",
    env,
    () => false,
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
});

test("tool messages require valid shape, bounded values and consent", () => {
  const lead = {
    id: "02ee21a3-114d-4eb6-894d-5a0a7a7752e7",
    type: "lead",
    name: "Alice",
    company: "Example",
    email: "alice@example.com",
    phone: "",
    requirement: "100 units",
    consent: true,
  };
  assert.equal(agentEventSchema.safeParse(lead).success, true);
  assert.equal(
    agentEventSchema.safeParse({ ...lead, consent: false }).success,
    false,
  );
  assert.equal(
    agentEventSchema.safeParse({ ...lead, email: "invalid" }).success,
    false,
  );
  assert.equal(
    agentEventSchema.safeParse({ ...lead, secret: "extra" }).success,
    false,
  );
  assert.equal(
    agentEventSchema.safeParse({
      id: lead.id,
      type: "handoff",
      reason: "Need a human",
    }).success,
    true,
  );
});

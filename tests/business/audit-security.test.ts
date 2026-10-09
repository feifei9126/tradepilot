import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertAdminCredentialPolicy, assertAdminRecord, isStrongAdminPassword } from "../../scripts/security/admin-policy.mjs";
import { verifyDeploymentAdmin, changeAccountPassword, getAuthSessionState, saveAdminRecord } from "@/lib/account";
import { hashPassword } from "@/lib/crypto";
import { loginClientIdentity, reserveLoginAttempt } from "@/lib/login-security";
import { resolveMailEndpoint } from "@/lib/email/network-policy";
import { validatedMediaType, mediaDeliveryPolicy } from "@/lib/media-content";
import { recordMarketingConsent, setSuppression, createUnsubscribeToken } from "@/lib/email/compliance";
import { GET as unsubscribeGET } from "@/app/api/email/unsubscribe/route";
import { boundedBytes } from "@/lib/request-json";

function setEnv(input: Record<string,string | undefined>) {
  const old = Object.fromEntries(Object.keys(input).map(key => [key,process.env[key]]));
  const apply = (values: Record<string,string | undefined>) => { for (const [key,value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } };
  apply(input); return () => apply(old);
}

test("production admin initialization rejects published/weak values, saved strong password wins and first login is restricted", async () => {
  const directory = await mkdtemp(join(tmpdir(),"tradepilot-policy-"));
  const restore = setEnv({ NODE_ENV:"production",TRADEPILOT_DATA_DIR:directory,TRADEPILOT_ADMIN_EMAIL:"admin@example.test",TRADEPILOT_ADMIN_PASSWORD:"12345678" });
  const strong = "Unique-Admin-9bE!7nZx";
  try {
    for (const weak of ["12345678","password","aaaaaaaaaaaaaaaa1","qwerty123456789012","replace-with-a-strong-password"]) assert.equal(isStrongAdminPassword(weak),false);
    assert.throws(() => assertAdminCredentialPolicy({}),/初始密码/);
    await assert.rejects(verifyDeploymentAdmin("admin@example.test","12345678"),/初始密码/);
    process.env.TRADEPILOT_ADMIN_PASSWORD = strong;
    assert.equal((await verifyDeploymentAdmin("admin@example.test",strong))?.mustChangePassword,true);
    assert.equal((await getAuthSessionState("deployment-admin","0")).mustChangePassword,true);
    await changeAccountPassword("deployment-admin",strong,"Changed-Admin-F8i!6yPw");
    process.env.TRADEPILOT_ADMIN_PASSWORD = "12345678";
    assert.equal(await verifyDeploymentAdmin("admin@example.test","12345678"),null);
    assert.equal((await verifyDeploymentAdmin("admin@example.test","Changed-Admin-F8i!6yPw"))?.mustChangePassword,false);
    await saveAdminRecord({ passwordHash:await hashPassword("12345678"),mustChangePassword:false });
    assert.equal(await verifyDeploymentAdmin("admin@example.test","12345678"),null,"legacy weak hashes must not unlock production admin");
  } finally { restore(); await rm(directory,{ recursive:true,force:true }); }
});

test("corrupt saved administrator records cannot fall back to environment credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tradepilot-admin-corrupt-"));
  const restore = setEnv({ NODE_ENV:"production", TRADEPILOT_DATA_DIR:dir, TRADEPILOT_ADMIN_EMAIL:"admin@example.test", TRADEPILOT_ADMIN_PASSWORD:"V7!Strong-Admin-Init-2026" });
  try {
    for (const record of [null, [], "string", { passwordHash:"not-a-pbkdf2-hash" }, { sessionVersion:123 }, { mustChangePassword:"false" }]) {
      assert.throws(() => assertAdminRecord(record));
      await writeFile(join(dir, "admin-account.json"), JSON.stringify(record));
      await assert.rejects(verifyDeploymentAdmin("admin@example.test", "V7!Strong-Admin-Init-2026"));
    }
    await writeFile(join(dir, "admin-account.json"), "{truncated");
    await assert.rejects(verifyDeploymentAdmin("admin@example.test", "V7!Strong-Admin-Init-2026"));
  } finally { restore(); await rm(dir, { recursive:true, force:true }); }
});

test("login identity ignores spoofed forwarded headers; only an authenticated explicitly configured edge can supply IP", () => {
  const restore = setEnv({ TRADEPILOT_TRUSTED_CLIENT_IP_HEADER:"x-real-ip",TRADEPILOT_PROXY_AUTH_SECRET:"edge-test-secret-".repeat(3) });
  try {
    const request = (extra = {}) => new Request("https://app.example/api/auth",{ headers:{ "x-forwarded-for":"8.8.8.8","x-real-ip":"1.1.1.1",...extra } });
    assert.equal(loginClientIdentity(request()),"unverified-peer");
    assert.equal(loginClientIdentity(request({ "x-tradepilot-proxy-auth":"forged" })),"unverified-peer");
    assert.equal(loginClientIdentity(request({ "x-tradepilot-proxy-auth":process.env.TRADEPILOT_PROXY_AUTH_SECRET! })),"1.1.1.1");
    assert.equal(loginClientIdentity(request({ "x-real-ip":"1.1.1.1, 127.0.0.1","x-tradepilot-proxy-auth":process.env.TRADEPILOT_PROXY_AUTH_SECRET! })),"unverified-peer");
  } finally { restore(); }
});

test("login shared store unavailable fails closed without process-local counters", async () => {
  const restore = setEnv({ DATABASE_URL:undefined,PGHOST:undefined });
  try { await assert.rejects(reserveLoginAttempt("unknown@example.test",new Request("http://localhost"))); }
  finally { restore(); }
});

test("mail endpoint policy blocks local/metadata/mixed DNS, mapped IPv6 and TLS downgrade ports", async () => {
  const restore = setEnv({ TRADEPILOT_MAIL_PRIVATE_ALLOWLIST:undefined });
  const endpoint = { host:"mail.example.test",port:465,secure:true,protocol:"smtp" as const };
  try {
    for (const address of ["127.0.0.1","10.0.0.1","169.254.169.254","::1","::ffff:7f00:1","::ffff:a9fe:a9fe","fc00::1","2002:7f00:1::"]) await assert.rejects(resolveMailEndpoint({ ...endpoint,host:address }),/内网|元数据/);
    await assert.rejects(resolveMailEndpoint(endpoint,async () => [{ address:"1.1.1.1",family:4 },{ address:"10.0.0.1",family:4 }]),/内网/);
    await assert.rejects(resolveMailEndpoint({ ...endpoint,secure:false,port:25 }),/STARTTLS/);
    const pinned = await resolveMailEndpoint({ ...endpoint,secure:false,port:587 },async () => [{ address:"1.1.1.1",family:4 }]);
    assert.equal(pinned.address,"1.1.1.1"); assert.equal(pinned.servername,"mail.example.test");
    await assert.rejects(resolveMailEndpoint(endpoint,async () => [{ address:"10.0.0.1",family:4 }]),/内网/,"a second resolution must revalidate a changed DNS answer");
    process.env.TRADEPILOT_MAIL_PRIVATE_ALLOWLIST = JSON.stringify({ "mail.example.test":["10.0.0.5","169.254.169.254"] });
    assert.equal((await resolveMailEndpoint(endpoint,async () => [{ address:"10.0.0.5",family:4 }])).address,"10.0.0.5");
    await assert.rejects(resolveMailEndpoint(endpoint,async () => [{ address:"169.254.169.254",family:4 }]),/内网/);
  } finally { restore(); }
});

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhWQAAAAASUVORK5CYII=","base64");
test("media validation uses content and extension, rejects active HTML/SVG and disguised mismatches", () => {
  assert.equal(validatedMediaType(png,"tiny.png","image/png"),"image/png");
  assert.equal(validatedMediaType(png,"tiny.png","application/octet-stream"),"image/png");
  for (const content of ["<!doctype html><script>alert(1)</script>","<svg onload='alert(1)'></svg>","<?xml version='1.0'?><svg/>"]) assert.throws(() => validatedMediaType(Buffer.from(content),"fake.png","image/png"),/不允许/);
  assert.throws(() => validatedMediaType(png,"tiny.html","image/png"),/扩展名/);
  assert.throws(() => validatedMediaType(png,"tiny.png","text/html"),/真实内容/);
  const legacy = mediaDeliveryPolicy({ filename:"old.svg",verifiedMimeType:null });
  assert.equal(legacy.contentType,"application/octet-stream"); assert.match(legacy.disposition,/^attachment/); assert.match(legacy.csp,/sandbox/);
  assert.match(mediaDeliveryPolicy({ filename:"new.pdf",verifiedMimeType:"application/pdf" }).disposition,/^attachment/);
});

test("upload byte limit cancels a chunked/forged-length stream before multipart parsing", async () => {
  let cancelled = false;
  const request = new Request("http://localhost/api/media",{ method:"POST",headers:{ "content-length":"1" },body:new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(100)); },cancel() { cancelled = true; } }),duplex:"half" } as RequestInit);
  await assert.rejects(boundedBytes(request,50),/过大/); assert.equal(cancelled,true);
});

test("members cannot directly subscribe/resubscribe or bypass recipient proof", async () => {
  await assert.rejects(recordMarketingConsent("00000000-0000-4000-8000-000000000001","a@example.test",{ subscribed:true,source:"admin-import" }),/收件人/);
  await assert.rejects(setSuppression("00000000-0000-4000-8000-000000000001","a@example.test",{ resubscribe:true }),/收件人/);
});

test("unsubscribe GET only renders confirmation, including link scanners; it does not touch DB", async () => {
  const restore = setEnv({ AUTH_SECRET:"test-consent-secret-".repeat(3),DATABASE_URL:undefined,PGHOST:undefined });
  try {
    const token = createUnsubscribeToken("00000000-0000-4000-8000-000000000001","a@example.test");
    const response = await unsubscribeGET(new Request(`https://app.example/api/email/unsubscribe?token=${token}`,{ headers:{ accept:"text/html" } }));
    assert.equal(response.status,200); assert.match(await response.text(),/确认退订/);
  } finally { restore(); }
});

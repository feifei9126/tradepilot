import assert from "node:assert/strict";
import test from "node:test";
import { isSuccessfulLogin, loginFailureMessage } from "../../src/lib/login-result";

test("Auth.js HTTP 200 with an authentication error never counts as a login", () => {
  assert.equal(isSuccessfulLogin({ ok: true, error: "CredentialsSignin", code: "credentials" }), false);
  assert.equal(isSuccessfulLogin({ ok: true, error: "Configuration" }), false);
  assert.equal(isSuccessfulLogin({ ok: true }), true);
  assert.equal(isSuccessfulLogin({ ok: false }), false);
  assert.equal(isSuccessfulLogin(undefined), false);
});

test("login separates service outages from credential rejection without exposing details", () => {
  const message = loginFailureMessage({ ok: true, error: "CredentialsSignin", code: "service_unavailable" });
  assert.match(message, /服务暂时不可用/);
  assert.doesNotMatch(message, /密码|数据库|postgres/);
  assert.match(loginFailureMessage({ error: "CredentialsSignin", code: "credentials" }), /邮箱和密码/);
  assert.match(loginFailureMessage({ error: "Configuration" }), /服务暂时不可用/);
  assert.match(loginFailureMessage(undefined), /服务暂时不可用/);
});

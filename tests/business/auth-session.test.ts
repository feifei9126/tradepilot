import test from "node:test";
import assert from "node:assert/strict";
import { applyAccountSessionState, usableSessionClaims } from "../../src/lib/auth-session";
import type { JWT } from "next-auth/jwt";
const token = (): JWT => ({ sub: "alice", companyId: "workspace-a", role: "owner", isPlatformAdmin: true });
test("数据库故障清除可用授权；恢复后仅权威 recheck 恢复", () => {
  const jwt = applyAccountSessionState(token(), { active: false, databaseUnavailable: true });
  assert.equal(jwt.invalidated, undefined);
  assert.deepEqual(usableSessionClaims(jwt), { id: "", companyId: undefined, role: undefined, isDeploymentWorkspace: false, isPlatformAdmin: false, mustChangePassword: false, databaseUnavailable: true });
  applyAccountSessionState(jwt, { active: true, companyId: "workspace-a", role: "member" });
  assert.equal(usableSessionClaims(jwt).id, "alice");
  assert.equal(usableSessionClaims(jwt).isPlatformAdmin, false);
});
test("已撤销 token 在启用账号/工作区后不会复活", () => {
  const jwt = applyAccountSessionState(token(), { active: false });
  applyAccountSessionState(jwt, { active: true, companyId: "workspace-a", role: "owner", isPlatformAdmin: true });
  assert.equal(usableSessionClaims(jwt).id, "");
  assert.equal(jwt.invalidated, true);
});
test("故障期间更改密码：故障恢复后仍被权威状态撤销", () => {
  const jwt = applyAccountSessionState(token(), { active: false, databaseUnavailable: true });
  applyAccountSessionState(jwt, { active: false });
  assert.equal(jwt.invalidated, true);
  assert.equal(usableSessionClaims(jwt).databaseUnavailable, false);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changeAccountPassword, getAccountProfile, updateAccountProfile, verifyDeploymentAdmin } from "../../src/lib/account";

test("部署管理员个人设置和修改密码持久化，旧环境密码不再有效", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tradepilot-account-"));
  const previous = {
    directory: process.env.TRADEPILOT_DATA_DIR,
    email: process.env.TRADEPILOT_ADMIN_EMAIL,
    password: process.env.TRADEPILOT_ADMIN_PASSWORD,
  };
  process.env.TRADEPILOT_DATA_DIR = directory;
  process.env.TRADEPILOT_ADMIN_EMAIL = "test@tradepilot.local";
  process.env.TRADEPILOT_ADMIN_PASSWORD = "original-password";
  try {
    assert.equal((await verifyDeploymentAdmin("test@tradepilot.local", "original-password"))?.name, "TradePilot Admin");
    const profile = await updateAccountProfile("deployment-admin", { name: "测试用户", locale: "en", timezone: "UTC" });
    assert.equal(profile.name, "测试用户");
    assert.equal((await getAccountProfile("deployment-admin")).timezone, "UTC");
    await assert.rejects(() => changeAccountPassword("deployment-admin", "wrong-password", "new-password-123"), /当前密码不正确/);
    await changeAccountPassword("deployment-admin", "original-password", "new-password-123");
    assert.equal(await verifyDeploymentAdmin("test@tradepilot.local", "original-password"), null);
    assert.equal((await verifyDeploymentAdmin("test@tradepilot.local", "new-password-123"))?.name, "测试用户");
    const file = join(directory, "admin-account.json");
    const contents = await readFile(file, "utf8");
    assert.equal(contents.includes("new-password-123"), false);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
  } finally {
    for (const [key, value] of Object.entries({
      TRADEPILOT_DATA_DIR: previous.directory,
      TRADEPILOT_ADMIN_EMAIL: previous.email,
      TRADEPILOT_ADMIN_PASSWORD: previous.password,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { postgresEnv, postgresPoolConfig, postgresProcessEnv } from "../../scripts/database/config.mjs";
import { readMigrationFiles, validateAppliedMigrations } from "../../scripts/database/migrations.mjs";
function isolatedEnv(fn) {
  const old = { ...process.env };
  for (const key of Object.keys(process.env)) if (key.startsWith("PG") || key.startsWith("RESTORE_") || key === "DATABASE_URL") delete process.env[key];
  try { return fn(); } finally { for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key]; Object.assign(process.env, old); }
}
test("URL 解码、端口和 TLS 严格配置，不允许未知或降级参数", () => isolatedEnv(() => {
  process.env.DATABASE_URL = "postgresql://alice:p%40ss@db.example:5433/trade?sslmode=require";
  assert.equal(postgresEnv().PGPASSWORD, "p@ss");
  assert.equal(postgresPoolConfig().port, 5433);
  assert.equal(postgresPoolConfig().ssl.rejectUnauthorized, false);
  for (const suffix of ["sslmode=prefer", "sslmode=disable&sslmode=require", "bogus=1", "sslmode=verify-full", "channel_binding=require"]) {
    process.env.DATABASE_URL = `postgresql://alice:pass@db/trade?${suffix}`;
    assert.throws(() => postgresPoolConfig());
  }
}));
test("verify-ca/full 明确 CA 和 hostname 策略；disable 不接受客户端证书", () => isolatedEnv(() => {
  const dir = mkdtempSync(join(tmpdir(), "tradepilot-tls-"));
  const ca = join(dir, "ca.pem"); writeFileSync(ca, "TEST CA");
  try {
    process.env.DATABASE_URL = "postgresql://alice:pass@db/trade";
    process.env.PGSSLMODE = "verify-full"; process.env.PGSSLROOTCERT = ca;
    assert.equal(postgresPoolConfig().ssl.ca, "TEST CA");
    assert.equal(postgresPoolConfig().ssl.rejectUnauthorized, true);
    assert.equal(postgresPoolConfig().ssl.checkServerIdentity, undefined);
    process.env.PGSSLMODE = "verify-ca";
    assert.equal(typeof postgresPoolConfig().ssl.checkServerIdentity, "function");
    delete process.env.PGSSLROOTCERT; process.env.PGSSLMODE = "disable";
    process.env.PGSSLCERT = ca; process.env.PGSSLKEY = ca;
    assert.throws(() => postgresPoolConfig());
  } finally { rmSync(dir, { recursive: true }); }
}));
test("恢复必须独立目标，绝不继承生产连接或 PGPASSWORD", () => isolatedEnv(() => {
  process.env.DATABASE_URL = "postgresql://prod:production-secret@production/prod";
  process.env.PGPASSWORD = "production-secret";
  assert.throws(() => postgresEnv({ restore: true }));
  process.env.RESTORE_DATABASE_URL = "postgresql://tester:test-secret@localhost/empty";
  const env = postgresProcessEnv({ restore: true });
  assert.equal(env.PGHOST, "localhost"); assert.equal(env.PGDATABASE, "empty");
  assert.equal(env.PGPASSWORD, "test-secret"); assert.equal(env.DATABASE_URL, undefined);
}));
test("迁移预检拒绝旧代码降级、checksum 篡改和历史缺口", () => {
  const files = [{ version: "0000.sql", checksum: "a" }, { version: "0001.sql", checksum: "b" }];
  assert.doesNotThrow(() => validateAppliedMigrations(files, [{ version: "0000.sql", checksum: "a" }]));
  assert.throws(() => validateAppliedMigrations(files, [{ version: "0002.sql", checksum: "c" }]), /downgrade/);
  assert.throws(() => validateAppliedMigrations(files, [{ version: "0000.sql", checksum: "changed" }]), /modified/);
  assert.throws(() => validateAppliedMigrations(files, [{ version: "0001.sql", checksum: "b" }]), /prefix/);
});
test("发布 manifest 精确匹配每个不可变 SQL 的 SHA256", async () => {
  const { DATABASE_MIGRATIONS } = await import("../../src/db/migrations");
  const files = await readMigrationFiles();
  assert.deepEqual(files.map(({ version, checksum }) => ({ version, checksum })), [...DATABASE_MIGRATIONS]);
});

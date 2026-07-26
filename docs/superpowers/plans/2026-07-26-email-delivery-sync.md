# TradePilot 邮件收发与同步实现计划

> **面向 AI 代理的工作者：** 实现前读取 `superpowers:executing-plans` 并按复选框执行。此计划依赖 `2026-07-26-multitenancy-access.md` 已完成的 `sealSecret/openSecret`、成员授权和迁移工具。

**目标：** 用 PostgreSQL 持久化邮箱账户、线程、邮件、附件和发送队列；Cloudflare 使用 Resend/Email Routing，Docker 使用 SMTP/IMAP，保留无数据库本地演示草稿。

**架构：** 路由只创建/查询租户邮件记录；发件通过 outbox；Provider adapter 只处理协议；Cloudflare `scheduled/email` 和 Docker `mail-worker` 都调用相同的 outbox/sync service。

**技术栈：** Drizzle、Web Crypto、Resend HTTPS API、`nodemailer`、`imapflow`、`postal-mime`、`sanitize-html`、Cloudflare R2/本地对象目录。

---

### 任务 1：安装邮件依赖并建立失败测试

**文件：**
- 修改：`package.json`
- 修改：`package-lock.json`
- 创建：`tests/business/email-security.test.ts`
- 创建：`tests/business/email-idempotency.test.ts`

- [ ] **步骤 1：增加依赖**

```json
{
  "dependencies": {
    "imapflow": "^1.0.190",
    "nodemailer": "^7.0.3",
    "postal-mime": "^2.4.4",
    "sanitize-html": "^2.17.0"
  },
  "devDependencies": {
    "@types/sanitize-html": "^2.16.0"
  }
}
```

执行 `npm install --package-lock-only` 后检查锁文件只增加上述依赖及其完整校验值。

- [ ] **步骤 2：写失败测试**

```ts
test("email credentials are never returned in account view", async () => {
  const account = await createEmailAccount(accountContext, smtpInput);
  const view = toEmailAccountView(account);
  assert.equal("password" in view, false);
  assert.equal(view.credentialsConfigured, true);
});

test("same provider message id is stored once per account", async () => {
  const first = await ingestInboundMessage(accountContext, rawMessage);
  const second = await ingestInboundMessage(accountContext, rawMessage);
  assert.equal(first.id, second.id);
});
```

- [ ] **步骤 3：运行确认失败**

运行：`npx tsx --test tests/business/email-security.test.ts tests/business/email-idempotency.test.ts`

预期：FAIL，报缺少邮件服务模块。

- [ ] **步骤 4：提交测试基线**

```bash
git add package.json package-lock.json tests/business/email-security.test.ts tests/business/email-idempotency.test.ts
git commit -m "test(email): define secure account and idempotent ingest behavior"
```

### 任务 2：创建邮件 schema、迁移和租户仓库

**文件：**
- 创建：`src/db/schema/email_accounts.ts`
- 创建：`src/db/schema/email_messages.ts`
- 创建：`src/db/schema/email_threads.ts`
- 创建：`src/db/schema/email_outbox.ts`
- 创建：`src/db/schema/email_events.ts`
- 修改：`src/db/schema/index.ts`
- 创建：`src/db/migrations/0002_email_workspace.sql`
- 创建：`src/lib/email/types.ts`
- 创建：`src/lib/email/repository.ts`
- 修改：`tests/database/migrations.test.ts`

- [ ] **步骤 1：定义字段与唯一约束**

所有表含 `company_id`；账户唯一键为 `(company_id, lower(email))`；消息唯一键为 `(account_id, normalized_message_key)`；事件唯一键为 `(provider, provider_event_id)`。正文列限制由服务层执行，附件表只保存对象键和校验摘要。

- [ ] **步骤 2：写幂等和租户 SQL 测试**

用 PostgreSQL 测试容器或现有 `tests/helpers/database.ts` 迁移两次，断言重复账户失败、重复消息返回同一 ID、Company A 不能读 Company B 的消息。

- [ ] **步骤 3：实现 schema 和迁移**

迁移使用 `CREATE TABLE IF NOT EXISTS`、`CREATE INDEX IF NOT EXISTS`，外键包含 company 边界；不修改现有 `email_campaigns` 旧表。消息内容保存 `text_body` 与清理后的 `html_body`，原始 MIME 可选保存到对象存储键。

- [ ] **步骤 4：实现 repository**

`src/lib/email/repository.ts` 暴露 `listAccounts/createAccount/updateAccount/deactivateAccount`、`listThreads/listMessages`、`insertInboundMessage`、`enqueue`、`leaseOutbox`、`markOutbox`、`recordProviderEvent`。每个查询都显式使用 `companyId`；`leaseOutbox` 用 `FOR UPDATE SKIP LOCKED`。

- [ ] **步骤 5：运行绿色数据库测试**

运行：`npm run test:db -- --test-name-pattern=email` 或 `npx tsx --test tests/database/migrations.test.ts tests/business/email-idempotency.test.ts`

预期：迁移可重复，幂等和租户测试 PASS。

- [ ] **步骤 6：提交数据层**

```bash
git add src/db/schema src/db/migrations/0002_email_workspace.sql src/lib/email tests/database/migrations.test.ts tests/business/email-idempotency.test.ts
git commit -m "feat(email): persist accounts threads messages and outbox"
```

### 任务 3：实现账户校验、凭据加密和本地草稿兼容

**文件：**
- 创建：`src/lib/email/validation.ts`
- 创建：`src/lib/email/views.ts`
- 修改：`src/app/api/email/accounts/route.ts`
- 修改：`src/app/api/email/route.ts`
- 创建：`tests/business/email-validation.test.ts`

- [ ] **步骤 1：先写输入边界测试**

覆盖非法邮箱、Unicode/空白主机名、端口越界、私网/metadata 地址、过长主题、附件超过 10 MiB 和演示模式保存草稿。

- [ ] **步骤 2：运行确认失败**

运行：`npx tsx --test tests/business/email-validation.test.ts`

预期：FAIL，旧路由仍使用进程内 `accounts` 数组且没有统一校验器。

- [ ] **步骤 3：实现 validation 与 host policy**

`parseEmailAccountInput` 返回已规范化的 SMTP/IMAP/Resend 配置；阻止回环、链路本地、云元数据地址，只有显式环境变量允许私网。端口仅允许 465/587/993/143 及 provider 允许的 TLS 端口。

- [ ] **步骤 4：接入 `sealSecret/openSecret`**

账户凭据 AAD 使用 `purpose: "email"`、company ID 和 account ID；`toEmailAccountView` 只返回主机、端口、邮箱、启用状态、`credentialsConfigured` 和健康状态。

- [ ] **步骤 5：替换旧 API**

GET/POST/PATCH 全部读取 `requireOrganizationAccess` 和 PostgreSQL repository；没有数据库时 GET 返回演示账户/空账户，POST 只接受 `save-draft`，真实发送返回 `PROVIDER_NOT_CONFIGURED`。

- [ ] **步骤 6：运行绿色测试并提交**

```bash
npx tsx --test tests/business/email-validation.test.ts tests/business/email-security.test.ts tests/business/email-idempotency.test.ts
git add src/lib/email src/app/api/email tests/business/email-validation.test.ts
git commit -m "feat(email): secure account configuration and demo fallback"
```

### 任务 4：实现 Resend 发信和入站归一化

**文件：**
- 创建：`src/lib/email/providers/contracts.ts`
- 创建：`src/lib/email/providers/resend.ts`
- 创建：`src/lib/email/inbound.ts`
- 创建：`src/lib/email/outbox.ts`
- 创建：`src/app/api/webhooks/email/resend/route.ts`
- 创建：`tests/business/resend-provider.test.ts`
- 创建：`tests/business/email-inbound.test.ts`

- [ ] **步骤 1：写 provider contract 测试**

使用注入的 `fetch` 测试 Resend 请求包含 `from/to/subject/html/text`、不记录 API key、HTTP 429 可重试、4xx 进入永久失败；入站 webhook 重复 event ID 不重复插入。

- [ ] **步骤 2：实现 Resend adapter**

直接调用 `https://api.resend.com/emails`，API key 从解密账户读取；把 Resend `id` 保存为 external ID。仅对 408/425/429/5xx 重试，禁止把 key 放入错误消息。

- [ ] **步骤 3：实现入站解析**

Webhook 校验账户 secret 和事件时间窗口，使用 `postal-mime` 解析 raw MIME；Cloudflare Email Routing `email()` 入口也转换成同一 `InboundEmail`。`Message-ID` 缺失时使用账户、发送方、日期、主题、正文哈希生成 key；HTML 使用 `sanitize-html` 白名单清理。

- [ ] **步骤 4：实现 outbox processor**

处理流程为 `lease -> decrypt -> adapter.send -> mark sent/failed`；租约过期可被下一次调度重取，最大尝试 8 次，退避 30 秒、2 分钟、10 分钟、30 分钟、2 小时、12 小时、24 小时。

- [ ] **步骤 5：运行 provider 测试**

运行：`npx tsx --test tests/business/resend-provider.test.ts tests/business/email-inbound.test.ts`

预期：PASS，覆盖签名失败、重复 webhook、HTML 清理和重试分类。

- [ ] **步骤 6：提交 Resend 适配器**

```bash
git add src/lib/email/providers src/lib/email/inbound.ts src/app/api/webhooks/email/resend src/lib/email/outbox.ts tests/business/resend-provider.test.ts tests/business/email-inbound.test.ts
git commit -m "feat(email): add resend delivery and inbound webhooks"
```

### 任务 5：实现 SMTP/IMAP mail-worker

**文件：**
- 创建：`workers/mail-worker/server.mjs`
- 创建：`workers/mail-worker/README.md`
- 创建：`src/lib/email/providers/smtp.ts`
- 创建：`src/lib/email/providers/imap.ts`
- 修改：`docker-compose.yml`
- 修改：`Dockerfile`
- 创建：`tests/business/mail-worker.test.ts`

- [ ] **步骤 1：写 worker 失败测试**

验证 worker 无数据库时退出配置错误、租用 outbox 后 SMTP 成功只发送一次、IMAP UID 重复不重复插入、单账户失败不影响下一账户。

- [ ] **步骤 2：实现 SMTP adapter**

`nodemailer.createTransport` 只接受已校验的 host/port/secure/username/password；发送前为每个 outbox id 建幂等锁，错误分类不包含密码。

- [ ] **步骤 3：实现 IMAP adapter**

`imapflow` 使用 `lock` 读取指定文件夹，按 UIDVALIDITY/last UID 增量拉取 raw source，`postal-mime` 转换后调用统一 `insertInboundMessage`。同步完成才更新 cursor；连接中断保留旧 cursor。

- [ ] **步骤 4：实现 worker 循环和健康检查**

worker 使用 `MAIL_WORKER_INTERVAL_MS`（默认 30 秒）循环，SIGTERM 等待当前租约完成后退出；`/health` 返回数据库可用、最近一次处理时间和失败计数，不返回账户凭据。

- [ ] **步骤 5：加入 Compose 服务和持久化卷**

`mail-worker` 使用 runner 镜像、同一 `DATABASE_URL`、`TRADEPILOT_CREDENTIALS_KEY` 和附件目录，依赖 postgres/tradepilot 健康状态；附件目录映射独立 `tradepilot_mail_attachments` volume。

- [ ] **步骤 6：运行 worker 测试并提交**

```bash
npx tsx --test tests/business/mail-worker.test.ts
docker compose config --quiet
git add workers/mail-worker src/lib/email/providers docker-compose.yml Dockerfile tests/business/mail-worker.test.ts
git commit -m "feat(email): add smtp delivery and imap sync worker"
```

### 任务 6：替换邮件工作台和账户设置

**文件：**
- 修改：`src/app/app/email/page.tsx`
- 修改：`src/app/app/email/settings/page.tsx`
- 创建：`src/app/api/email/messages/[id]/route.ts`
- 创建：`tests/business/email-routes.test.ts`

- [ ] **步骤 1：编写路由/权限测试**

验证 member 可撰写/发送，viewer 只能读取，admin 可测试账户；Company A 的消息 ID 在 Company B 返回 404；关联客户 ID 必须属于当前组织。

- [ ] **步骤 2：实现消息 API**

列表支持 folder/q/accountId 分页；PATCH 只允许已读、星标和当前租户关联字段；POST 先校验收件人和账户，再写 outbox，不在请求中直接调用 SMTP。

- [ ] **步骤 3：更新 UI 状态**

设置页显示连接状态和最近错误；邮件工作台显示线程、发件状态、重试失败、附件和客户/询盘/订单关联。演示模式继续保存本地草稿且明确显示未连接真实邮箱。

- [ ] **步骤 4：运行完整邮件测试并提交**

```bash
npx tsx --test tests/business/email-routes.test.ts tests/business/email-*.test.ts
npx tsc --noEmit
git add src/app/app/email src/app/api/email/messages tests/business/email-routes.test.ts
git commit -m "feat(email): connect persistent mailbox workspace"
```

### 任务 7：邮件阶段验收

- [ ] **步骤 1：验证迁移、测试、构建**

```bash
npm run test:db
npm test
npm run build
```

- [ ] **步骤 2：验证凭据与日志**

```bash
rg -n "password|apiKey|privateKey|TRADEPILOT_CREDENTIALS_KEY" src/lib/email workers/mail-worker
```

预期：只出现字段名、解密调用或安全配置文档，不出现日志打印或响应返回。

- [ ] **步骤 3：提交阶段验收**

```bash
git commit --allow-empty -m "test(email): verify delivery and sync phase"
```

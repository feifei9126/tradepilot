# TradePilot 平台部署与最终验收实现计划

> **面向 AI 代理的工作者：** 实现前读取 `superpowers:executing-plans`。此计划在多租户、邮件和订单支付代码完成后执行，专门处理 Cloudflare Worker 入口、R2/Cron、Docker 初始化和发布验证。

**目标：** 让 Cloudflare 和 Docker 部署拥有同一套密钥、迁移和健康检查语义，并验证生产构建不会因为邮件 worker、RSA 代码或 R2 binding 破坏。

**架构：** OpenNext 负责 Next fetch；`wrangler.jsonc.main` 固定指向根目录 `src/cloudflare-worker.ts`，wrapper 导入构建产物 `.open-next/worker.js` 并实现 `fetch/scheduled/email`；Docker 继续运行 Next Web 与独立 mail-worker。部署脚本生成/校验主密钥，只上传运行时需要的 secrets。

**技术栈：** Wrangler、OpenNext Cloudflare、Cloudflare R2、Cron Triggers、Docker Compose、PowerShell/Bash、现有 deploy tests。

---

### 任务 1：先建立部署配置失败测试

**文件：**
- 创建：`tests/build/email-payment-config.test.mjs`
- 修改：`tests/build/wrangler-config.test.mjs`
- 修改：`tests/deploy/cloudflare-setup.test.mjs`
- 修改：`tests/deploy/docker-database.test.mjs`

- [ ] **步骤 1：写失败断言**

测试要求 `wrangler.jsonc` 含 `EMAIL_ATTACHMENTS` R2 binding、Cron schedule 和 Email event handler；`.env.example` 含 `TRADEPILOT_CREDENTIALS_KEY`、`TRADEPILOT_APP_URL`；Cloudflare dry-run 步骤包含 credential secret；Compose 含 mail-worker、附件卷和健康检查。

- [ ] **步骤 2：运行确认失败**

运行：`node --test tests/build/email-payment-config.test.mjs tests/build/wrangler-config.test.mjs tests/deploy/cloudflare-setup.test.mjs tests/deploy/docker-database.test.mjs`

预期：FAIL，现有配置没有这些 binding/服务/secret。

- [ ] **步骤 3：提交配置测试基线**

```bash
git add tests/build/email-payment-config.test.mjs tests/build/wrangler-config.test.mjs tests/deploy/cloudflare-setup.test.mjs tests/deploy/docker-database.test.mjs
git commit -m "test(deploy): define mail payment runtime configuration"
```

### 任务 2：实现 Cloudflare Worker fetch/scheduled/email 入口

**文件：**
- 创建：`src/cloudflare-worker.ts`
- 修改：`wrangler.jsonc`
- 修改：`open-next.config.ts`
- 修改：`package.json`
- 创建：`tests/build/cloudflare-worker-entry.test.mjs`

- [ ] **步骤 1：确认 OpenNext 入口契约**

阅读已安装 `node_modules/@opennextjs/cloudflare/dist/cli/templates/worker.js` 与 `getCloudflareContext` 文档，确认当前版本的默认 fetch handler 契约；wrapper 必须导入 `./.open-next/worker.js` 的 default 并保持其 `fetch(request, env, ctx)` 参数顺序。

- [ ] **步骤 2：实现入口**

入口把 `fetch(request, env, ctx)` 转发给 `openNextWorker.fetch(request, env, ctx)`；`scheduled` 调用 Resend outbox processor；`email` 将 Cloudflare raw message 交给 inbound parser。处理器错误写结构化日志并返回，不把邮件正文/凭据写日志。

- [ ] **步骤 3：添加 R2/Cron 配置**

`wrangler.jsonc` 的 `main` 改为 `src/cloudflare-worker.ts`，增加 `EMAIL_ATTACHMENTS` R2 bucket binding 与每 5 分钟 Cron；`npm run cfbuild` 先生成 `.open-next/worker.js`，随后 `wrangler deploy` 编译根目录 wrapper。

- [ ] **步骤 4：运行入口测试**

运行：`node --test tests/build/cloudflare-worker-entry.test.mjs tests/build/wrangler-config.test.mjs`

预期：PASS，fetch/scheduled/email 导出存在，binding 名称一致。

- [ ] **步骤 5：提交入口**

```bash
git add src/cloudflare-worker.ts wrangler.jsonc open-next.config.ts package.json tests/build/cloudflare-worker-entry.test.mjs
git commit -m "feat(deploy): add cloudflare mail events and scheduled outbox"
```

### 任务 3：扩展 Cloudflare 一键配置

**文件：**
- 修改：`scripts/setup-cloudflare.mjs`
- 修改：`.env.example`
- 修改：`docs/postgresql-deployment.md`
- 创建：`tests/deploy/cloudflare-secrets.test.mjs`

- [ ] **步骤 1：写失败测试**

测试 dry-run 和 non-interactive 模式要求 `TRADEPILOT_CREDENTIALS_KEY`；没有该 key 时给出生成命令，不输出 key；步骤顺序包含 `secret TRADEPILOT_CREDENTIALS_KEY`、R2 bucket 检查和迁移提示。

- [ ] **步骤 2：实现密钥生成/校验**

复用 Node `crypto.randomBytes(32).toString("base64url")`；校验 decode 后恰好 32 字节。环境已有 key 时不覆盖；dry-run 使用固定无效占位值且明确不执行外部命令。

- [ ] **步骤 3：实现 Cloudflare secrets 与 R2 步骤**

新增 `npx wrangler secret put TRADEPILOT_CREDENTIALS_KEY`；R2 bucket 由显式命令/配置创建，已存在时继续；部署脚本仍不上传管理员密码。迁移仍在 Neon/PostgreSQL 上执行，不在 Worker 启动时自动 DDL。

- [ ] **步骤 4：运行 setup tests**

运行：`node --test tests/deploy/cloudflare-secrets.test.mjs tests/deploy/cloudflare-setup.test.mjs`

预期：PASS，日志中没有数据库密码、管理员密码或主加密密钥原文。

- [ ] **步骤 5：提交配置**

```bash
git add scripts/setup-cloudflare.mjs .env.example docs/postgresql-deployment.md tests/deploy/cloudflare-secrets.test.mjs
git commit -m "feat(deploy): configure credential encryption and attachments"
```

### 任务 4：扩展 Docker Compose、安装脚本和健康检查

**文件：**
- 修改：`docker-compose.yml`
- 修改：`Dockerfile`
- 修改：`install.sh`
- 修改：`install.bat`
- 修改：`src/app/api/health/route.ts`
- 创建：`tests/deploy/mail-worker-compose.test.mjs`

- [ ] **步骤 1：写失败配置测试**

断言 install.sh/install.bat 幂等生成 `TRADEPILOT_CREDENTIALS_KEY`，Compose mail-worker 使用相同 DB/key、挂载附件卷、依赖 postgres 健康；健康接口报告 `database`, `mailWorker` 状态但不泄露配置。

- [ ] **步骤 2：实现脚本变量**

两种脚本均读取已有 `.env`，缺少或格式错误时生成 32 字节 key；保留已有值；`.env` 权限继续限制为当前用户。测试模式只打印命令，不运行 Docker，不打印秘密。

- [ ] **步骤 3：接入 Compose**

mail-worker 使用 runner 镜像命令 `node workers/mail-worker/server.mjs`，设置 `MAIL_WORKER_INTERVAL_MS`、`TRADEPILOT_DATA_DIR` 和附件目录，加入健康检查与 restart policy；TradePilot 依赖 mail-worker healthy 只在主站需要真实邮件时启用，演示模式不阻塞启动。

- [ ] **步骤 4：运行部署测试**

运行：`node --test tests/deploy/mail-worker-compose.test.mjs tests/deploy/docker-database.test.mjs`

预期：PASS。若本机没有 Docker，只验证 Compose 配置解析和脚本测试，不声称真实容器重启测试通过。

- [ ] **步骤 5：提交 Docker 集成**

```bash
git add docker-compose.yml Dockerfile install.sh install.bat src/app/api/health/route.ts tests/deploy/mail-worker-compose.test.mjs
git commit -m "feat(deploy): add mail worker and credential bootstrap"
```

### 任务 5：更新文档、依赖和安全说明

**文件：**
- 修改：`README.md`
- 修改：`SECURITY.md`
- 修改：`docs/postgresql-deployment.md`
- 创建：`docs/email-and-payments.md`
- 修改：`package.json`

- [ ] **步骤 1：补充最短部署路径**

分别写 Cloudflare 和 Docker 的数据库、主密钥、R2、Cron、Resend、SMTP/IMAP、Stripe/支付宝/微信配置步骤，明确服务商密钥只在后台或 Secrets 中保存。

- [ ] **步骤 2：补充回调清单**

列出公开 webhook URL、HTTPS 要求、Stripe endpoint secret、支付宝异步通知地址、微信 API v3 证书/Key、Resend inbound secret 和部署后连接测试。

- [ ] **步骤 3：依赖/审计检查**

运行 `npm install --package-lock-only`、`npm audit --audit-level=critical`；不执行破坏性的 `npm audit fix --force`。新依赖若有 critical 漏洞必须更换实现，而不是忽略。

- [ ] **步骤 4：提交文档**

```bash
git add README.md SECURITY.md docs/postgresql-deployment.md docs/email-and-payments.md package.json package-lock.json
git commit -m "docs: document email and order payment deployment"
```

### 任务 6：最终验证循环

- [ ] **步骤 1：运行全部自动化验证**

```bash
npm run verify
npm run test:db
npm run test:deploy
npm run test:coverage
npm run cfbuild
npx wrangler deploy --dry-run
npm audit --audit-level=critical
```

- [ ] **步骤 2：验证运行模式**

无 `DATABASE_URL` 的 `npm run dev` 必须仍能登录演示账号并保存本地草稿；`NODE_ENV=production` 无数据库必须返回 `DATABASE_NOT_CONFIGURED`；有 PostgreSQL 时业务和组织测试使用真实 UUID。

- [ ] **步骤 3：验证敏感信息和 diff**

```bash
rg -n "ghp_|sk_live_|sk_test_|BEGIN .*PRIVATE KEY|console\.(log|error).*password|console\.(log|error).*secret" src scripts workers docs .env.example
git diff origin/feature/postgresql-persistence...HEAD --check
git status --short --branch
```

预期：没有真实凭据或秘密日志；工作树只剩验证生成物（若有）并在提交前清理。

- [ ] **步骤 4：按发布要求复核 Docker 限制**

有 Docker 时运行 `docker compose --env-file .env up -d postgres db-init tradepilot mail-worker`，创建测试组织/邮件草稿后重启 `tradepilot mail-worker`，再次读取确认 PostgreSQL 数据保留。无 Docker 时在交付记录中明确未执行该项。

- [ ] **步骤 5：提交最终验证记录**

```bash
git commit --allow-empty -m "test(deploy): verify multi-tenant email and payment release"
```

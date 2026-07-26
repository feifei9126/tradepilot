# PostgreSQL 部署、升级与故障排查

TradePilot 的生产环境强制使用 PostgreSQL。支持 Neon，也支持可通过 TLS 连接的普通 PostgreSQL 服务。本地 `npm run dev` 可以在没有 `DATABASE_URL` 时使用内存演示模式，但该模式不适合生产，进程重启后不会保留修改。

## 数据库范围

生产数据库持久化客户、产品、询盘、报价、订单、物流、单据，以及这些流程直接依赖的联系人、沟通记录和业务编号。新数据库默认不写入演示业务数据。

只有显式设置以下开关时才会导入演示数据：

```text
TRADEPILOT_SEED_DEMO=true
```

## 准备连接串

连接串必须使用 `postgres://` 或 `postgresql://`。不要把真实连接串写入 Git、问题截图或构建日志。

Neon 示例形状：

```text
postgresql://<user>:<password>@<neon-host>/<database>?sslmode=require
```

普通 TLS PostgreSQL 示例形状：

```text
postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require
```

数据库账号需要对目标数据库拥有建表、改表、创建 schema 和读写业务表的权限。应用使用 postgres.js 且关闭 prepared statements，兼容 Neon 连接池和常见 PostgreSQL 代理。

## 数据库命令

| 命令 | 作用 | 是否写数据 |
| --- | --- | --- |
| `npm run db:status` | 检查连接、迁移版本和管理员状态 | 否 |
| `npm run db:migrate` | 应用仓库中已提交的正式迁移 | 是，修改 schema |
| `npm run db:bootstrap` | 幂等创建或更新 owner 管理员 | 是 |
| `npm run db:seed` | 开关启用时填充演示业务记录 | 是 |
| `npm run db:init` | 顺序执行 migrate、bootstrap 和可选 seed | 是 |

所有命令都从当前进程读取 `DATABASE_URL`。`db:bootstrap` 还要求：

```text
TRADEPILOT_ADMIN_EMAIL=<admin-email>
TRADEPILOT_ADMIN_PASSWORD=<strong-password>
```

管理员密码必须为 8-128 个字符。bootstrap 会保存密码哈希；对同一邮箱重复运行会更新 owner 用户，不会创建第二个工作区。初始化完成后，不需要把管理员明文密码保留为应用运行时变量。

## 初始化空数据库

1. 创建空 PostgreSQL 数据库和有足够权限的数据库账号。
2. 在当前终端设置 `DATABASE_URL`、管理员邮箱和管理员密码。
3. 运行 `npm run db:status`，确认网络和连接串可用。
4. 运行 `npm run db:migrate`。
5. 运行 `npm run db:bootstrap`。
6. 再次运行 `npm run db:status`，预期 `migrations` 为 `current`、`bootstrapRequired` 为 `false`。
7. 部署应用并请求 `/api/health`。

也可以用 `npm run db:init` 合并步骤 4-5。默认 `TRADEPILOT_SEED_DEMO=false`；只有明确需要演示数据时才设为 `true` 后运行 `db:seed` 或 `db:init`。

PowerShell 当前会话示例：

```powershell
$env:DATABASE_URL = 'postgresql://<user>:<password>@<host>/<database>?sslmode=require'
$env:TRADEPILOT_ADMIN_EMAIL = '<admin-email>'
$env:TRADEPILOT_ADMIN_PASSWORD = '<strong-password>'
npm run db:init
```

Bash 当前会话示例：

```bash
export DATABASE_URL='postgresql://<user>:<password>@<host>/<database>?sslmode=require'
export TRADEPILOT_ADMIN_EMAIL='<admin-email>'
export TRADEPILOT_ADMIN_PASSWORD='<strong-password>'
npm run db:init
```

## 升级旧账号数据库

早期版本可能只有 `companies` 和 `users` 两张表。正式迁移兼容这种旧数据库，会保留现有公司和用户，并补齐核心业务表、列、索引、复合外键和迁移日志。

升级顺序：

1. 使用提供商快照或 `pg_dump` 备份数据库。
2. 使用将要部署的同一版本代码执行 `npm ci`。
3. 设置该生产数据库的 `DATABASE_URL`。
4. 运行 `npm run db:status` 并记录结果。
5. 运行 `npm run db:migrate`，不要在生产使用 `drizzle-kit push`。
6. 仅当状态显示 `bootstrapRequired: true` 时运行 `npm run db:bootstrap`。
7. 再次运行 `db:status`，然后部署应用。
8. 请求 `/api/health`，再验证登录和一个只读业务列表。

迁移失败时不要反复修改生产表或删除迁移日志。保留失败输出中的安全错误码，检查权限、磁盘空间和锁等待；如需恢复到迁移前状态，停止新版本应用并从升级前备份恢复到单独数据库后验证。仓库不承诺自动向下迁移。

备份命令可以只引用当前终端变量，避免把连接串写进 shell 历史：

```bash
pg_dump "$DATABASE_URL" --format=custom --file=tradepilot-before-upgrade.dump
```

备份文件包含业务数据和密码哈希，应按生产敏感数据加密存放并限制访问。

## Docker 一条命令部署

Linux、macOS、WSL 或 Git Bash：

```bash
bash install.sh
```

Windows 命令提示符或 PowerShell：

```powershell
.\install.bat
```

安装器会创建或复用本机 `.env`，生成 `AUTH_SECRET`、PostgreSQL 密码和管理员密码，然后按以下顺序运行：

```text
postgres -> db-init -> tradepilot/video-worker -> health check
```

PostgreSQL 数据保存在 `tradepilot_postgres` volume。重复运行安装器不会删除 volume，`db:init` 和管理员 bootstrap 可幂等重跑。`docker compose down` 默认保留 volume；不要在有生产数据时使用会删除 volume 的参数。

## Cloudflare Workers

推荐从有 Node.js 22、数据库网络访问和 Wrangler 登录状态的本机执行：

```bash
npm install
npm run setup:cloudflare
```

引导命令依次执行 status、migrate、bootstrap、可选 seed、设置 `DATABASE_URL`/`AUTH_SECRET` Worker secrets、OpenNext 构建、Wrangler 部署和 `/api/health` 验证。管理员密码只传给本地 bootstrap 子进程，不会上传到 Worker，也不会写入 `wrangler.jsonc`。

只预览流程：

```bash
npm run setup:cloudflare -- --dry-run
```

非交互环境必须在当前进程中提供数据库、管理员和健康检查输入；不要把这些值提交到仓库。

### Cloudflare Git 自动构建

Cloudflare Git 集成中的构建命令可以使用 `npm run cfbuild`，部署命令使用 `npx wrangler deploy`。Cloudflare Git 自动构建不执行数据库迁移，因为构建阶段不应依赖运行时 secret，也不能保证数据库管理网络权限。

每次包含数据库迁移的升级都必须先从受控环境运行 `npm run db:migrate`，确认状态正常后再触发 Cloudflare Git 构建。仅重新连接 GitHub 仓库或清除构建缓存不会修复数据库 schema。

## 健康检查

`GET /api/health` 不要求登录，也不返回连接串、主机或 SQL。正常生产响应包括：

```json
{
  "status": "ok",
  "storage": "postgresql",
  "database": "connected",
  "migrations": "current",
  "bootstrapRequired": false
}
```

开发环境未配置数据库时，健康检查会显示 `storage: "memory"`。生产环境不会接受 memory 状态。

## 故障排查

### `DATABASE_NOT_CONFIGURED`

含义：生产 Worker/容器运行时没有读到 `DATABASE_URL`。

处理：

1. 确认变量设置在实际运行的 Worker 环境或容器，而不只是 Cloudflare 构建环境。
2. Cloudflare 使用 `npx wrangler secret put DATABASE_URL` 或重新运行引导命令。
3. 重新部署后请求 `/api/health`。

不要通过改成内存模式绕过生产数据库要求。

### `DATABASE_UNAVAILABLE`

含义：连接串存在，但数据库连接、DNS、网络、TLS 或凭据失败。

处理：

1. 从运行 `db:status` 的机器检查提供商状态和连接串。
2. Neon 或公网 PostgreSQL 通常需要 `sslmode=require`。
3. 检查数据库是否暂停、IP 访问规则是否允许、账号密码是否已轮换。
4. 更新 Worker secret 后重新部署并检查健康端点。

应用日志只应出现安全错误分类；不要把完整 `DATABASE_URL` 粘贴到公开日志。

### `DATABASE_SCHEMA_OUTDATED`

含义：数据库可连接，但迁移不是当前版本，或者管理员 bootstrap 尚未完成。

处理：

1. 运行 `npm run db:status` 区分迁移状态和 `bootstrapRequired`。
2. `migrations: "outdated"` 时先备份，再运行 `npm run db:migrate`。
3. `bootstrapRequired: true` 时设置管理员邮箱和密码，再运行 `npm run db:bootstrap`。
4. 健康检查恢复 200 后再开放流量。

### `bootstrapRequired`

`bootstrapRequired: true` 表示当前迁移版本下没有可用 owner 用户。它不是要求把管理员密码设为永久 Worker secret，而是要求从受控环境执行一次幂等 bootstrap。

## Secret 管理

- `.env` 只保存在部署机器，禁止提交；Docker 安装器会尽量限制文件权限。
- Cloudflare Worker 运行时只需要数据库连接和会话等运行时 secrets；管理员密码不应上传。
- 不要使用 `NEXT_PUBLIC_*` 保存数据库、管理员、AI 或第三方服务密钥。
- 轮换 `DATABASE_URL` 或 `AUTH_SECRET` 后重新部署并验证健康检查和登录。
- 如果任何 PAT、连接串或密码曾出现在聊天、日志或 Git 历史中，立即在对应提供商撤销并生成新凭据。

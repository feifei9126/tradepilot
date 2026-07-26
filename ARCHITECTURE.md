# TradePilot 架构文档

## 架构总览

TradePilot 是 Next.js 16 App Router 应用。页面和 API 共用 NextAuth 会话；核心 CRM API 不直接访问全局数组或数据库客户端，而是通过租户绑定的异步 `BusinessRepository` 操作业务数据。成员管理、邮件和订单收款分别使用租户绑定的 organization、email 和 payment 仓库，并共享同一套可信会话上下文。

```text
Browser
  |
  v
NextAuth middleware
  |  删除客户端伪造的 x-tradepilot-* 请求头
  |  从已验证 session 注入 userId/companyId/role
  v
Next.js API route
  |  requireBusinessContext() 校验 UUID 上下文
  v
getBusinessRepository(context)
  |-- development/test + no DATABASE_URL --> Memory repository
  `-- DATABASE_URL configured ----------------> PostgreSQL repository
                                                      |
                                                      v
                                             Drizzle + postgres.js
```

生产环境没有 `DATABASE_URL` 时会返回 `DATABASE_NOT_CONFIGURED`，不会降级为内存数据。构建阶段不连接数据库；运行时和数据库管理命令负责检查连接、迁移与管理员状态。

## 运行模式

| 环境 | `DATABASE_URL` | 存储模式 |
| --- | --- | --- |
| `npm run dev` | 未配置 | 内存演示数据和演示账号 |
| 开发或测试 | 已配置 | PostgreSQL |
| 生产 | 已配置 | PostgreSQL |
| 生产 | 未配置 | 503 配置错误 |

内存实现只用于零配置开发。它按 `companyId` 分区，并只为固定的开发演示租户装载演示快照。生产数据库默认空库；只有部署时显式设置 `TRADEPILOT_SEED_DEMO=true` 才执行 seed。

## 认证与可信租户上下文

认证拆成两个运行时边界：

- `src/lib/auth-config.ts` 提供 middleware 可用的 Edge 会话配置，不加载 PostgreSQL 驱动。
- `src/lib/auth.ts` 和 `src/lib/auth-credentials.ts` 在登录请求中校验凭据。内存模式只接受开发演示账号；PostgreSQL 模式从 `users` 表读取密码哈希。

`src/middleware.ts` 在受保护的页面和 API 前运行。它先删除请求里已有的 `x-tradepilot-user-id`、`x-tradepilot-company-id` 和 `x-tradepilot-role`，再使用已验证 session 的值重新注入。API 通过 `requireBusinessContext()` 校验用户和公司 ID 都是 UUID，避免把浏览器可控请求头当作授权依据。

生产管理员由 `npm run db:bootstrap` 创建或更新：公司和用户使用真实 UUID，密码只以哈希保存。`TRADEPILOT_ADMIN_PASSWORD` 是初始化输入，不是 Worker 运行时的明文登录捷径。

## 仓库边界

`src/lib/repositories/contracts.ts` 定义 `BusinessRepository`，包含以下租户绑定接口：

- `contacts`：客户、联系人、批量导入和受引用删除保护；
- `products`：产品查询和创建；
- `inquiries`：询盘查询、创建和状态/AI 回复更新；
- `quotations`：报价创建、原子编号和状态流转；
- `orders`：从已接受报价事务化创建订单并更新履约状态；
- `shipments`：物流创建、单向状态推进和订单联动；
- `documents`：订单单据查询、生成和删除；
- `dashboard`：读取当前租户的业务快照。

两套实现遵循同一份异步契约：

- `src/lib/repositories/memory.ts` 使用按租户分区的内存状态，供本地演示和快速单元测试使用。
- `src/lib/repositories/postgres/` 使用 Drizzle 查询和 postgres.js 事务，供配置数据库的开发环境和所有生产环境使用。

API route 负责 HTTP 输入校验、状态码与响应格式；仓库负责租户条件、数据映射、约束错误和跨实体事务。报价转订单、物流推进与订单状态联动不会在 route 中进行非原子双写。

## PostgreSQL 数据模型

当前持久化主链为：

```text
companies
  |-- users -- organization_memberships
  |-- organization_invitations
  |-- contacts -- contact_persons
  |      |-- inquiries
  |      |-- quotations -- orders -- shipments
  |      |                         `-- documents
  |      `------------------------- communications
  |-- products
  |-- email_accounts -- email_threads -- email_messages
  |        |                `-------- email_events
  |        `------------------------- email_outbox
  |-- payment_accounts -- payment_attempts -- payment_refunds
  |                           |
  |                  payment_requests -- orders
  `-- document_sequences
```

核心父表提供 `(company_id, id)` 唯一键，直接依赖表使用包含 `company_id` 的复合外键。PostgreSQL 仓库的读取、更新和删除仍显式加入当前 `companyId` 条件，形成应用层与数据库层两道租户隔离。

报价号和订单号由 `document_sequences` 按公司、类型和年份原子递增。唯一约束防止重复；事务失败可以留下空号，但不会回退或复用编号。

金额、日期和 JSON 字段在 `src/lib/repositories/postgres/mappers.ts` 中集中转换。数据库异常被映射为稳定领域错误，客户端不会收到连接串、SQL 参数或底层堆栈。

邮箱和支付凭据不以明文保存。`TRADEPILOT_CREDENTIALS_KEY` 使用 AES-GCM 信封加密，并把 `companyId`、凭据用途和记录 ID 绑定到附加认证数据。密钥必须在 Web 应用、Cloudflare Cron 和 Docker `mail-worker` 之间保持一致；轮换密钥前必须重新加密或准备重新录入全部账户凭据。

邮件发送先写入 `email_outbox`。Docker `mail-worker` 租用 SMTP 队列并执行 IMAP 增量同步；Cloudflare Cron 每 5 分钟只处理 Resend 队列，Resend 入站 webhook 验签后再读取并规范化邮件正文。支付 webhook 通过服务商签名和公开账户 ID 定位租户，事件幂等写入数据库后更新收款或退款状态。

## 迁移与健康检查

正式迁移位于 `src/db/migrations/`。当前迁移同时支持：

- 全新的空 PostgreSQL 数据库；
- 旧版仅含 `companies` 和 `users` 的账号数据库。

数据库管理入口是 `npm run db:status`、`db:migrate`、`db:bootstrap`、`db:seed` 和 `db:init`。这些命令是独立、可重复执行的部署步骤，不由 `next build` 或 Cloudflare Git 构建隐式触发。

公开的 `/api/health` 只返回安全状态：存储模式、连接状态、迁移状态和 `bootstrapRequired`。主要故障码为：

- `DATABASE_NOT_CONFIGURED`：生产没有 `DATABASE_URL`；
- `DATABASE_UNAVAILABLE`：连接、网络或 TLS 不可用；
- `DATABASE_SCHEMA_OUTDATED`：迁移未完成或仍需管理员 bootstrap。

详细升级顺序和排错方法见 `docs/postgresql-deployment.md`。

## 部署拓扑

### Docker Compose

```text
postgres (persistent volume, healthcheck)
  |
  v
db-init (migrate + bootstrap + optional seed, run once)
  |
  v
tradepilot (persistent product-video data)
  |
  +-- video-worker
  +-- mail-worker (SMTP outbox + IMAP sync)
  `-- moneyprinterturbo -- redis
```

`install.sh` 和 `install.bat` 幂等生成本机 `.env`，启动 PostgreSQL，运行 `db-init`，再启动应用。`tradepilot` 只有在数据库初始化容器成功后才启动。重复运行安装器不会删除 PostgreSQL volume 或重建业务数据。

### Cloudflare Workers

```text
Local setup command
  |-- status -> migrate -> bootstrap -> optional seed
  |-- wrangler secret put DATABASE_URL/AUTH_SECRET/CREDENTIALS_KEY/CRON_SECRET
  |-- OpenNext build -> Wrangler deploy
  `-- GET /api/health

Cloudflare Worker ---------------- TLS ----------------> Neon/PostgreSQL
  |-- scheduled every 5 minutes -----------------------> Resend outbox
  `-- Resend signed webhook ---------------------------> inbound email
```

`npm run setup:cloudflare` 在有数据库网络访问的本机运行管理步骤，再部署 Worker。管理员密码仅用于本地 bootstrap，不上传到 Worker。稳定运行密钥保存在被 Git 忽略的 `.env.cloudflare`，供重复部署复用。Cloudflare Git 自动构建只构建和部署代码，版本升级前必须另外运行迁移。

Cloudflare Workers 不提供本地 Docker、FFmpeg 或持久文件系统；Firecrawl、MoneyPrinterTurbo 和 OpenMontage 在该拓扑中需要独立服务。

## 当前边界

本阶段持久化范围是工作区成员和邀请，客户、产品、询盘、报价、订单、物流、单据及其直接需要的联系人、沟通记录和编号，以及邮件账户/消息/outbox 和订单支付账户/收款/退款。以下模块没有统一迁移到 `BusinessRepository`：

- 供应商、库存、采购、财务明细和知识库等扩展模块；
- AI 提供商的浏览器侧 BYOK 配置；
- 产品视频任务与生成资产，它们继续使用现有文件/volume 或外部 Worker；
- Firecrawl、MoneyPrinterTurbo 和 OpenMontage 服务自身的数据。

邮件和支付功能仍有明确的运行边界：本地无数据库 `npm run dev` 只提供内存演示邮件和草稿，不执行真实邮件或支付；Cloudflare 邮件只使用 Resend，不运行 SMTP/IMAP；支付只覆盖订单收款和退款，不包含订阅套餐或平台计费。

这些边界不能依赖核心 CRM 的 PostgreSQL 持久化来推断其已经持久化。

## 验证分层

- `npm test`：内存模式业务、页面构建契约、Firecrawl 和视频测试；
- `npm run test:db`：真实 PostgreSQL 迁移、健康检查、仓库契约和事务工作流；
- `npm run test:deploy`：Docker/安装器、Cloudflare 引导与构建配置；
- `npm run test:coverage`：业务和仓库层覆盖率门槛；
- `npm run verify`：默认测试、lint、TypeScript 和 Next.js 生产构建。
